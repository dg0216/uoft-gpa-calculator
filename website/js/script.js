/* UofT GPA Calculator: course search, GPA calculations, and local saving. */

// 1. Variables
const academicYears = [
    { year: "1st Year", courses: [] }, { year: "2nd Year", courses: [] },
    { year: "3rd Year", courses: [] }, { year: "4th Year", courses: [] },
    { year: "Other", courses: [] }
];
const STORAGE_KEY = "gpaCalculatorData";
const THEME_KEY = "gpaCalculatorTheme";
const METER_CIRCUMFERENCE = 339.292;
let courseDatabase = [];
let selectedCourse = null;
let academicYearInput, courseNameInput, gradeInput, gradePreview, selectedCourseInfo;
let addCourseButton, calculateGPAButton, toggleCoursesButton, resetButton, themeToggle;
let courseWorkspace, courseListSection, courseTableBody, courseCount, gpaSummary;
let yearGpaSummary, gpaResult, gpaMeterProgress, summaryMeta, errorMessage, suggestionsList;

function showError(message) { errorMessage.textContent = message; errorMessage.hidden = false; }
function clearError() { errorMessage.textContent = ""; errorMessage.hidden = true; }

// 2. Load courses.json
function loadCourseDatabase() {
    return fetch("data/courses.json")
        .then(function (response) {
            if (!response.ok) throw new Error("Course database request failed.");
            return response.json();
        })
        .then(function (data) {
            if (!Array.isArray(data)) throw new Error("Course database has an invalid format.");
            courseDatabase = data;
        })
        .catch(function () { showError("Unable to load course database. Please refresh and try again."); });
}

// 3. Local storage functions
function saveData() {
    const data = {
        years: academicYears,
        selectedAcademicYear: academicYearInput.value,
        summaryVisible: !gpaSummary.classList.contains("hidden"),
        workspaceHidden: courseWorkspace.classList.contains("hidden")
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch (error) { console.warn("Unable to save calculator data.", error); }
}

function clearSavedData() {
    try { localStorage.removeItem(STORAGE_KEY); }
    catch (error) { console.warn("Unable to clear calculator data.", error); }
}

function createSavedCourse(course) {
    if (!course || typeof course.code !== "string" || typeof course.title !== "string") return null;
    const credits = Number(course.credits);
    const percentage = Number(course.percentage);
    const grade = convertPercentageToGrade(percentage);
    if (!Number.isFinite(credits) || credits <= 0 || !grade) return null;
    return { code: course.code, title: course.title, credits: credits, percentage: percentage, letterGrade: grade.letter, gradePoint: grade.points };
}

// 4. Load saved data
function loadSavedData() {
    const initialState = { selectedAcademicYear: "1st Year", summaryVisible: false, workspaceHidden: false };
    try {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (!savedData) return initialState;
        const data = JSON.parse(savedData);
        if (!data || !Array.isArray(data.years)) return initialState;
        academicYears.forEach(function (yearGroup) {
            const savedYear = data.years.find(function (group) { return group && group.year === yearGroup.year; });
            yearGroup.courses = savedYear && Array.isArray(savedYear.courses)
                ? savedYear.courses.map(createSavedCourse).filter(Boolean) : [];
        });
        return {
            selectedAcademicYear: getYearGroup(data.selectedAcademicYear) ? data.selectedAcademicYear : initialState.selectedAcademicYear,
            summaryVisible: Boolean(data.summaryVisible),
            workspaceHidden: Boolean(data.workspaceHidden || data.coursesHidden)
        };
    } catch (error) { console.warn("Unable to load saved calculator data.", error); return initialState; }
}

// 5. Academic year management
function getYearGroup(year) { return academicYears.find(function (group) { return group.year === year; }); }
function getSelectedYearGroup() { return getYearGroup(academicYearInput.value); }
function hasCourses() { return academicYears.some(function (group) { return group.courses.length > 0; }); }
function getAllCourses() { return academicYears.flatMap(function (group) { return group.courses; }); }

// 6. Course search and autocomplete
function findMatchingCourses(searchText) {
    const query = searchText.trim().toLowerCase();
    if (!query) return [];
    return courseDatabase.filter(function (course) {
        return String(course.code).toLowerCase().includes(query) || String(course.title).toLowerCase().includes(query);
    }).slice(0, 3);
}

function hideSuggestions() { suggestionsList.replaceChildren(); suggestionsList.hidden = true; }
function showSuggestions(matches) {
    hideSuggestions();
    matches.forEach(function (course) {
        const suggestion = document.createElement("button");
        const code = document.createElement("strong");
        const detail = document.createElement("span");
        suggestion.type = "button";
        code.textContent = course.code;
        detail.textContent = course.title + " · " + Number(course.credits).toFixed(1) + " credit" + (Number(course.credits) === 1 ? "" : "s");
        suggestion.append(code, detail);
        suggestion.addEventListener("click", function () { selectCourse(course); });
        suggestionsList.appendChild(suggestion);
    });
    suggestionsList.hidden = matches.length === 0;
}

function handleCourseSearch() {
    selectedCourse = null;
    selectedCourseInfo.textContent = "";
    showSuggestions(findMatchingCourses(courseNameInput.value));
}

function selectCourse(course) {
    selectedCourse = { code: course.code, title: course.title, credits: Number(course.credits) };
    courseNameInput.value = selectedCourse.code;
    selectedCourseInfo.textContent = selectedCourse.title + " · " + selectedCourse.credits.toFixed(1) + " credit" + (selectedCourse.credits === 1 ? "" : "s");
    clearError(); hideSuggestions(); gradeInput.focus();
}

// 7. Percentage-to-GPA conversion
function convertPercentageToGrade(percent) {
    if (percent === "" || percent === null || percent === undefined) return null;
    const value = Number(percent);
    if (!Number.isFinite(value) || value < 0 || value > 100) return null;
    if (value >= 90) return { letter: "A+", points: 4.0 }; if (value >= 85) return { letter: "A", points: 4.0 };
    if (value >= 80) return { letter: "A-", points: 3.7 }; if (value >= 77) return { letter: "B+", points: 3.3 };
    if (value >= 73) return { letter: "B", points: 3.0 }; if (value >= 70) return { letter: "B-", points: 2.7 };
    if (value >= 67) return { letter: "C+", points: 2.3 }; if (value >= 63) return { letter: "C", points: 2.0 };
    if (value >= 60) return { letter: "C-", points: 1.7 }; if (value >= 57) return { letter: "D+", points: 1.3 };
    if (value >= 53) return { letter: "D", points: 1.0 }; if (value >= 50) return { letter: "D-", points: 0.7 };
    return { letter: "F", points: 0.0 };
}

function updateGradePreview() {
    const grade = convertPercentageToGrade(gradeInput.value);
    gradePreview.textContent = grade ? grade.letter + " · " + grade.points.toFixed(1) + " GPA" : gradeInput.value ? "Enter a grade from 0 to 100" : "";
}

// 8. Add course
function addCourse() {
    const yearGroup = getSelectedYearGroup();
    const grade = convertPercentageToGrade(gradeInput.value);
    const validCourse = selectedCourse && courseDatabase.find(function (course) { return course.code === selectedCourse.code && Number(course.credits) === selectedCourse.credits; });
    if (!yearGroup) { showError("Please select an academic year."); academicYearInput.focus(); return; }
    if (!validCourse) { showError("Please select a valid UofT course."); courseNameInput.focus(); return; }
    if (!grade) { showError("Please enter a grade between 0 and 100."); gradeInput.focus(); return; }
    if (yearGroup.courses.some(function (course) { return course.code === selectedCourse.code; })) { showError("This course has already been added to " + yearGroup.year + "."); return; }
    yearGroup.courses.push({ code: selectedCourse.code, title: selectedCourse.title, credits: selectedCourse.credits, percentage: Number(gradeInput.value), letterGrade: grade.letter, gradePoint: grade.points });
    clearError(); displayCourses(); clearInputs(); resetResultsView(); saveData();
}

function clearInputs() {
    courseNameInput.value = ""; gradeInput.value = ""; gradePreview.textContent = ""; selectedCourseInfo.textContent = ""; selectedCourse = null; hideSuggestions(); courseNameInput.focus();
}

// 9. Display courses
function makeIcon(path) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const svgPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true"); svgPath.setAttribute("d", path); svg.appendChild(svgPath); return svg;
}

function displayCourses() {
    courseTableBody.replaceChildren();
    const allCourses = getAllCourses();
    courseCount.textContent = allCourses.length + " course" + (allCourses.length === 1 ? "" : "s");
    if (!allCourses.length) {
        const empty = document.createElement("div"); empty.className = "empty-state";
        empty.innerHTML = "<strong>No courses added yet.</strong>Search the UofT database to begin building your record.";
        courseTableBody.appendChild(empty); return;
    }
    academicYears.forEach(function (yearGroup) {
        if (!yearGroup.courses.length) return;
        const group = document.createElement("section"); group.className = "year-group";
        const header = document.createElement("div"); header.className = "year-group-header";
        const title = document.createElement("h3"); const gpa = document.createElement("span");
        title.textContent = yearGroup.year; gpa.textContent = "Year GPA " + calculateYearGPA(yearGroup.year).toFixed(2); header.append(title, gpa);
        const grid = document.createElement("div"); grid.className = "course-card-grid";
        yearGroup.courses.forEach(function (course, index) {
            const card = document.createElement("article"); card.className = "course-card";
            const top = document.createElement("div"); top.className = "course-card-top";
            const text = document.createElement("div"); const code = document.createElement("p"); const courseTitle = document.createElement("p");
            code.className = "course-code"; code.textContent = course.code; courseTitle.className = "course-title"; courseTitle.textContent = course.title; text.append(code, courseTitle); top.appendChild(text);
            const bottom = document.createElement("div"); bottom.className = "course-card-bottom";
            const details = document.createElement("div"); details.className = "course-details";
            ["Grade", course.percentage + "% (" + course.letterGrade + ")", "GPA", course.gradePoint.toFixed(1), "Credits", String(course.credits)].forEach(function (value, detailIndex, detailsArray) {
                if (detailIndex % 2 === 0) return;
                const item = document.createElement("span"); item.innerHTML = "<b>" + detailsArray[detailIndex - 1] + ":</b> " + value; details.appendChild(item);
            });
            const remove = document.createElement("button"); remove.type = "button"; remove.className = "remove-button"; remove.setAttribute("aria-label", "Remove " + course.code); remove.appendChild(makeIcon("M4 7h16M10 11v6m4-6v6M9 7l1-2h4l1 2m-8 0 1 13h8l1-13"));
            remove.addEventListener("click", function () { removeCourse(yearGroup.year, index, card); }); bottom.append(details, remove); card.append(top, bottom); grid.appendChild(card);
        });
        group.append(header, grid); courseTableBody.appendChild(group);
    });
}

// 10. GPA calculations
function calculateYearGPA(year) {
    const group = getYearGroup(year); if (!group || !group.courses.length) return null;
    let weightedPoints = 0, totalCredits = 0;
    group.courses.forEach(function (course) { weightedPoints += course.gradePoint * course.credits; totalCredits += course.credits; });
    return totalCredits ? weightedPoints / totalCredits : null;
}

function calculateCumulativeGPA() {
    let weightedPoints = 0, totalCredits = 0;
    getAllCourses().forEach(function (course) { weightedPoints += course.gradePoint * course.credits; totalCredits += course.credits; });
    return totalCredits ? weightedPoints / totalCredits : 0;
}

function animateNumber(target) {
    const start = Number(gpaResult.textContent) || 0; const duration = 650; const started = performance.now();
    function step(time) { const progress = Math.min((time - started) / duration, 1); const eased = 1 - Math.pow(1 - progress, 3); gpaResult.textContent = (start + (target - start) * eased).toFixed(2); if (progress < 1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
}

function displayGpaSummary() {
    const cumulative = calculateCumulativeGPA(); const courses = getAllCourses(); const credits = courses.reduce(function (sum, course) { return sum + course.credits; }, 0);
    yearGpaSummary.replaceChildren();
    academicYears.forEach(function (group) {
        const card = document.createElement("article"); card.className = "year-gpa-card";
        const name = document.createElement("p"); const value = document.createElement("strong"); const result = calculateYearGPA(group.year);
        name.textContent = group.year; value.textContent = result === null ? "—" : result.toFixed(2); card.append(name, value); yearGpaSummary.appendChild(card);
    });
    summaryMeta.textContent = courses.length + " courses · " + credits.toFixed(1) + " credits";
    gpaMeterProgress.style.strokeDashoffset = METER_CIRCUMFERENCE;
    requestAnimationFrame(function () { gpaMeterProgress.style.strokeDashoffset = String(METER_CIRCUMFERENCE * (1 - cumulative / 4)); });
    animateNumber(cumulative);
}

// 11. Calculate GPA button
function showGpaSummary() {
    if (!hasCourses()) { showError("No courses added yet."); return; }
    clearError(); displayGpaSummary(); gpaSummary.classList.remove("hidden"); courseWorkspace.classList.add("hidden"); saveData(); setActiveNavigation("gpaSummary");
    gpaSummary.scrollIntoView({ behavior: "smooth", block: "start" });
}

// 12. Edit courses / collapse toggle
function editCourses() { courseWorkspace.classList.remove("hidden"); gpaSummary.classList.add("hidden"); saveData(); setActiveNavigation("coursesSection"); courseNameInput.focus(); }
function resetResultsView() { courseWorkspace.classList.remove("hidden"); gpaSummary.classList.add("hidden"); }

// 13. Remove course
function removeCourse(year, index, card) {
    card.classList.add("removing");
    window.setTimeout(function () { const group = getYearGroup(year); group.courses.splice(index, 1); clearError(); displayCourses(); resetResultsView(); saveData(); }, 180);
}

// 14. Reset functionality
function resetCalculator() {
    if (!window.confirm("Are you sure you want to delete all courses and GPA data?")) return;
    academicYears.forEach(function (group) { group.courses.length = 0; }); academicYearInput.value = "1st Year"; clearError(); clearInputs(); displayCourses(); resetResultsView(); clearSavedData(); setActiveNavigation("coursesSection");
}

// 15. Theme and navigation
function applyTheme(theme) {
    document.documentElement.dataset.theme = theme; const isLight = theme === "light";
    themeToggle.setAttribute("aria-pressed", String(isLight)); themeToggle.setAttribute("aria-label", isLight ? "Switch to dark theme" : "Switch to light theme");
}
function toggleTheme() { const next = document.documentElement.dataset.theme === "light" ? "dark" : "light"; applyTheme(next); localStorage.setItem(THEME_KEY, next); }
function setActiveNavigation(targetId) { document.querySelectorAll(".nav-link").forEach(function (link) { link.classList.toggle("active", link.getAttribute("href") === "#" + targetId); }); }

// 16. Event listeners
document.addEventListener("DOMContentLoaded", function () {
    academicYearInput = document.getElementById("academicYear"); courseNameInput = document.getElementById("courseName"); gradeInput = document.getElementById("grade"); gradePreview = document.getElementById("gradePreview"); selectedCourseInfo = document.getElementById("selectedCourseInfo");
    addCourseButton = document.getElementById("addCourseButton"); calculateGPAButton = document.getElementById("calculateGPAButton"); toggleCoursesButton = document.getElementById("toggleCoursesButton"); resetButton = document.getElementById("resetButton"); themeToggle = document.getElementById("themeToggle");
    courseWorkspace = document.getElementById("courseWorkspace"); courseListSection = document.getElementById("courseListSection"); courseTableBody = document.getElementById("courseTableBody"); courseCount = document.getElementById("courseCount"); gpaSummary = document.getElementById("gpaSummary"); yearGpaSummary = document.getElementById("yearGpaSummary"); gpaResult = document.getElementById("gpaResult"); gpaMeterProgress = document.getElementById("gpaMeterProgress"); summaryMeta = document.getElementById("summaryMeta"); errorMessage = document.getElementById("errorMessage");
    suggestionsList = document.createElement("div"); suggestionsList.id = "courseSuggestions"; suggestionsList.className = "course-suggestions"; suggestionsList.setAttribute("role", "listbox"); suggestionsList.hidden = true; courseNameInput.closest(".course-search-container").appendChild(suggestionsList);
    courseNameInput.addEventListener("input", handleCourseSearch); gradeInput.addEventListener("input", updateGradePreview); addCourseButton.addEventListener("click", addCourse); calculateGPAButton.addEventListener("click", showGpaSummary); toggleCoursesButton.addEventListener("click", editCourses); resetButton.addEventListener("click", resetCalculator); themeToggle.addEventListener("click", toggleTheme);
    document.addEventListener("click", function (event) { if (!courseNameInput.contains(event.target) && !suggestionsList.contains(event.target)) hideSuggestions(); });
    document.querySelectorAll(".nav-link").forEach(function (link) {
        link.addEventListener("click", function (event) {
            const targetId = link.getAttribute("href").slice(1);

            // The GPA dashboard is hidden until it has a real result to show.
            if (targetId === "gpaSummary") {
                event.preventDefault();

                if (hasCourses()) {
                    showGpaSummary();
                } else {
                    showError("Add at least one course before calculating GPA.");
                    courseWorkspace.classList.remove("hidden");
                    document.getElementById("coursesSection").scrollIntoView({ behavior: "smooth", block: "start" });
                    courseNameInput.focus();
                }
                return;
            }

            setActiveNavigation(targetId);
        });
    });
    applyTheme(localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark");
    const state = loadSavedData(); academicYearInput.value = state.selectedAcademicYear; displayCourses(); resetResultsView();
    if (state.summaryVisible && hasCourses()) { displayGpaSummary(); gpaSummary.classList.remove("hidden"); if (state.workspaceHidden) courseWorkspace.classList.add("hidden"); }
    loadCourseDatabase();
});
