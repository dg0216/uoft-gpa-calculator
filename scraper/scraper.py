"""
File: scraper.py

Purpose:
Build the UofT GPA Calculator course database from the Academic Calendar and
Timetable Builder sources.

Output:
data/calendar_courses.json
data/timetable_courses.json
data/courses.json
"""

import json
import re
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError, sync_playwright


CALENDAR_URL = "https://artsci.calendar.utoronto.ca/search-courses"
TIMETABLE_API_URL = "https://api.easi.utoronto.ca/ttb/getPageableCourses"
PROJECT_ROOT = Path(__file__).resolve().parent.parent
CALENDAR_FILE = PROJECT_ROOT / "data" / "calendar_courses.json"
TIMETABLE_FILE = PROJECT_ROOT / "data" / "timetable_courses.json"
OUTPUT_FILE = PROJECT_ROOT / "data" / "courses.json"
COURSE_CODE_PATTERN = re.compile(r"^[A-Z]{3,4}\d{2,3}[HY]\d$")
PAGE_SIZE = 100


def get_credits(course_code: str) -> Optional[float]:
    """Return the credit value indicated by a valid UofT course code."""
    code = course_code.strip().upper()

    if not COURSE_CODE_PATTERN.fullmatch(code):
        return None
    if code[-2] == "H":
        return 0.5
    if code[-2] == "Y":
        return 1.0

    return None


def make_course(code: str, title: str) -> Optional[dict]:
    """Create a clean course record containing only code, title, and credits."""
    clean_code = "".join(code.split()).upper()
    clean_title = " ".join(title.split())
    credits = get_credits(clean_code)

    if not clean_title or credits is None:
        return None

    return {"code": clean_code, "title": clean_title, "credits": credits}


def parse_calendar_course(label: str) -> Optional[dict]:
    """Convert an Academic Calendar aria-label into a course record."""
    if not label or " - " not in label:
        return None

    code, title = label.split(" - ", 1)
    return make_course(code, title)


def wait_for_calendar(page: Page) -> None:
    """Wait for the Calendar page and its dynamic course results."""
    page.wait_for_load_state("domcontentloaded")

    try:
        page.wait_for_load_state("networkidle", timeout=15_000)
    except PlaywrightTimeoutError:
        pass

    try:
        page.wait_for_selector("[aria-label]", timeout=15_000)
    except PlaywrightTimeoutError:
        pass


def find_next_calendar_page(page: Page) -> Optional[str]:
    """Return the next Calendar results page URL, if one is available."""
    selectors = (
        "a[rel='next']",
        ".pager__item--next a",
        "a[title='Go to next page']",
        "a[aria-label='Next']",
        "a[aria-label='Next page']",
    )

    for selector in selectors:
        locator = page.locator(selector)
        if locator.count() == 0:
            continue

        next_link = locator.first
        if not next_link.is_visible():
            continue

        href = next_link.get_attribute("href")
        disabled = next_link.get_attribute("aria-disabled") == "true"
        classes = next_link.get_attribute("class") or ""

        if href and not disabled and "disabled" not in classes.lower():
            return urljoin(page.url, href)

    return None


def scrape_calendar_courses() -> list[dict]:
    """Scrape all Calendar result pages and return unique sorted courses."""
    courses_by_code: dict[str, dict] = {}

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            page = browser.new_page(viewport={"width": 1440, "height": 1000})
            current_url: Optional[str] = CALENDAR_URL
            visited_urls: set[str] = set()

            while current_url and current_url not in visited_urls:
                visited_urls.add(current_url)
                page.goto(current_url, wait_until="domcontentloaded", timeout=60_000)
                wait_for_calendar(page)
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(500)

                soup = BeautifulSoup(page.content(), "html.parser")
                for element in soup.select("[aria-label]"):
                    course = parse_calendar_course(element.get("aria-label", ""))
                    if course is not None:
                        courses_by_code[course["code"]] = course

                current_url = find_next_calendar_page(page)
        finally:
            browser.close()

    return sorted(courses_by_code.values(), key=lambda course: course["code"])


def load_timetable_page(page: int) -> dict[str, Any]:
    """Request one page from the Timetable Builder course API."""
    payload = {
        "courseCodeAndTitleProps": {
            "courseCode": "",
            "courseTitle": "",
            "courseSectionCode": "",
            "searchCourseDescription": False,
        },
        "departmentProps": [],
        "campuses": [],
        "sessions": ["20265F", "20265S", "20265"],
        "requirementProps": [],
        "instructor": "",
        "courseLevels": [],
        "deliveryModes": [],
        "dayPreferences": [],
        "timePreferences": [],
        "divisions": [],
        "creditWeights": [],
        "availableSpace": False,
        "waitListable": False,
        "page": page,
        "pageSize": PAGE_SIZE,
        "direction": "asc",
    }
    headers = {
        "Content-Type": "application/json",
        "Origin": "https://ttb.utoronto.ca",
        "Accept": "application/json, text/plain, */*",
        "User-Agent": "Mozilla/5.0",
    }

    response = requests.post(TIMETABLE_API_URL, json=payload, headers=headers, timeout=30)
    response.raise_for_status()

    try:
        data = response.json()
    except requests.JSONDecodeError as error:
        content_type = response.headers.get("Content-Type", "unknown")
        raise RuntimeError(
            "The Timetable Builder API did not return JSON "
            f"(Content-Type: {content_type})."
        ) from error

    if not isinstance(data, dict):
        raise ValueError("The Timetable Builder API returned an invalid response.")

    return data


def find_timetable_records(data: Any) -> list[dict[str, Any]]:
    """Find course records without keeping unrelated API metadata."""
    records: list[dict[str, Any]] = []

    if isinstance(data, dict):
        if ("courseCode" in data or "code" in data) and (
            "courseTitle" in data or "title" in data or "name" in data
        ):
            records.append(data)

        for value in data.values():
            records.extend(find_timetable_records(value))
    elif isinstance(data, list):
        for value in data:
            records.extend(find_timetable_records(value))

    return records


def scrape_timetable_courses() -> list[dict]:
    """Request all Timetable Builder pages and return unique sorted courses."""
    courses_by_code: dict[str, dict] = {}
    previous_page_codes: Optional[set[str]] = None
    page = 1

    while True:
        response_data = load_timetable_page(page)
        page_courses = []

        for record in find_timetable_records(response_data):
            code = record.get("courseCode") or record.get("code", "")
            title = (
                record.get("courseTitle")
                or record.get("title")
                or record.get("name", "")
            )
            if isinstance(code, str) and isinstance(title, str):
                course = make_course(code, title)
                if course is not None:
                    page_courses.append(course)

        page_codes = {course["code"] for course in page_courses}
        if not page_codes or page_codes == previous_page_codes:
            break

        for course in page_courses:
            courses_by_code[course["code"]] = course

        previous_page_codes = page_codes
        page += 1

    return sorted(courses_by_code.values(), key=lambda course: course["code"])


def merge_courses(calendar_courses: list[dict], timetable_courses: list[dict]) -> list[dict]:
    """Keep Calendar courses first and add only missing Timetable course codes."""
    courses_by_code: dict[str, dict] = {}

    for source_courses in (calendar_courses, timetable_courses):
        for course in source_courses:
            code = course.get("code") if isinstance(course, dict) else None
            if isinstance(code, str) and code not in courses_by_code:
                courses_by_code[code] = course

    return sorted(courses_by_code.values(), key=lambda course: course["code"])


def save_json(courses: list[dict], output_file: Path) -> None:
    """Save a course list as formatted UTF-8 JSON."""
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with output_file.open("w", encoding="utf-8") as json_file:
        json.dump(courses, json_file, ensure_ascii=False, indent=4)
        json_file.write("\n")


def main() -> None:
    """Build both source databases and the final searchable course database."""
    print("Loading UofT Academic Calendar courses...")
    calendar_courses = scrape_calendar_courses()
    save_json(calendar_courses, CALENDAR_FILE)
    print(f"Found {len(calendar_courses)} calendar courses")

    print("Loading UofT Timetable Builder courses...")
    timetable_courses = scrape_timetable_courses()
    save_json(timetable_courses, TIMETABLE_FILE)
    print(f"Found {len(timetable_courses)} timetable courses")

    courses = merge_courses(calendar_courses, timetable_courses)
    save_json(courses, OUTPUT_FILE)
    print(f"Saved {len(courses)} merged courses to data/courses.json")


if __name__ == "__main__":
    main()
