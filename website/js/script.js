/*
 * UofT GPA Calculator
 * Course data is kept separate so another university database can be used later.
 */

// 1. Variables
const academicYears = [
    { year: "1st Year", courses: [] },
    { year: "2nd Year", courses: [] },
    { year: "3rd Year", courses: [] },
    { year: "4th Year", courses: [] },
    { year: "Other", courses: [] }
];

const STORAGE_KEY = "gpaCalculatorData";

let courseDatabase = [];
let selectedCourse = null;

let academicYearInput;
let courseNameInput;
let gradeInput;
let gradePreview;
let addCourseButton;
let resetButton;
let calculateGPAButton;
let toggleCoursesButton;
let courseListSection;
let courseTableBody;
let yearGpaSummary;
let gpaResult;
let gpaSummary;
let errorMessage;
let suggestionsList;

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
}

function clearError() {
    errorMessage.textContent = "";
    errorMessage.hidden = true;
}

// 2. Load courses.json
function loadCourseDatabase() {
    // The fallback supports this project's nested website folder.
    const databasePaths = ["data/courses.json", "../data/courses.json"];

    return Promise.any(databasePaths.map(function (path) {
        return fetch(path).then(function (response) {
            if (!response.ok) {
                throw new Error("Course database request failed.");
            }
            return response.json();
        });
    }))
        .then(function (data) {
            if (!Array.isArray(data)) {
                throw new Error("Course database has an invalid format.");
            }

            courseDatabase = data;
        })
        .catch(function () {
            courseDatabase = [];
            const message = window.location.protocol === "file:"
                ? "Open this project with a local web server to load the course database."
                : "Unable to load course database.";
            showError(message);
        });
}

// 3. Local storage functions
function saveData() {
    const data = {
        years: academicYears,
        selectedAcademicYear: academicYearInput.value,
        summaryVisible: !gpaSummary.classList.contains("hidden"),
        coursesHidden: courseListSection.classList.contains("hidden")
    };

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        console.warn("Unable to save calculator data.", error);
    }
}

function clearSavedData() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.warn("Unable to clear calculator data.", error);
    }
}

function createSavedCourse(course) {
    if (!course || typeof course.code !== "string" || typeof course.title !== "string") {
        return null;
    }

    const credits = Number(course.credits);
    const percentage = Number(course.percentage);
    const convertedGrade = convertPercentageToGrade(percentage);

    if (!Number.isFinite(credits) || credits <= 0 || !convertedGrade) {
        return null;
    }

    return {
        code: course.code,
        title: course.title,
        credits: credits,
        percentage: percentage,
        letterGrade: convertedGrade.letter,
        gradePoint: convertedGrade.points
    };
}

// 4. Load saved data
function loadSavedData() {
    const defaultState = {
        selectedAcademicYear: "1st Year",
        summaryVisible: false,
        coursesHidden: false
    };

    try {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (!savedData) {
            return defaultState;
        }

        const data = JSON.parse(savedData);
        if (!data || !Array.isArray(data.years)) {
            return defaultState;
        }

        academicYears.forEach(function (yearGroup) {
            const savedYear = data.years.find(function (savedGroup) {
                return savedGroup && savedGroup.year === yearGroup.year;
            });

            yearGroup.courses = savedYear && Array.isArray(savedYear.courses)
                ? savedYear.courses.map(createSavedCourse).filter(Boolean)
                : [];
        });

        return {
            selectedAcademicYear: getYearGroup(data.selectedAcademicYear)
                ? data.selectedAcademicYear
                : defaultState.selectedAcademicYear,
            summaryVisible: Boolean(data.summaryVisible),
            coursesHidden: Boolean(data.coursesHidden)
        };
    } catch (error) {
        console.warn("Unable to load saved calculator data.", error);
        return defaultState;
    }
}

// 5. Academic year management
function getYearGroup(year) {
    return academicYears.find(function (yearGroup) {
        return yearGroup.year === year;
    });
}

function getSelectedYearGroup() {
    return getYearGroup(academicYearInput.value);
}

// 6. Course search and autocomplete
function findMatchingCourses(searchText) {
    const query = searchText.trim().toLowerCase();

    if (query === "") {
        return [];
    }

    return courseDatabase.filter(function (course) {
        return String(course.code).toLowerCase().includes(query) ||
            String(course.title).toLowerCase().includes(query);
    }).slice(0, 3);
}

function hideSuggestions() {
    suggestionsList.replaceChildren();
    suggestionsList.hidden = true;
}

function showSuggestions(matches) {
    hideSuggestions();

    if (matches.length === 0) {
        return;
    }

    matches.forEach(function (course) {
        const suggestion = document.createElement("button");
        suggestion.type = "button";
        suggestion.textContent = course.code + " - " + course.title;
        suggestion.addEventListener("click", function () {
            selectCourse(course);
        });
        suggestionsList.appendChild(suggestion);
    });

    suggestionsList.hidden = false;
}

function handleCourseSearch() {
    // A typed value is not trusted until it is chosen from the database.
    selectedCourse = null;
    showSuggestions(findMatchingCourses(courseNameInput.value));
}

function selectCourse(course) {
    selectedCourse = {
        code: course.code,
        title: course.title,
        credits: Number(course.credits)
    };

    courseNameInput.value = selectedCourse.code;
    clearError();
    hideSuggestions();
    gradeInput.focus();
}

// 7. Percentage conversion
function convertPercentageToGrade(percent) {
    if (percent === "" || percent === null || percent === undefined) {
        return null;
    }

    const percentage = Number(percent);
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
        return null;
    }

    if (percentage >= 90) return { letter: "A+", points: 4.0 };
    if (percentage >= 85) return { letter: "A", points: 4.0 };
    if (percentage >= 80) return { letter: "A-", points: 3.7 };
    if (percentage >= 77) return { letter: "B+", points: 3.3 };
    if (percentage >= 73) return { letter: "B", points: 3.0 };
    if (percentage >= 70) return { letter: "B-", points: 2.7 };
    if (percentage >= 67) return { letter: "C+", points: 2.3 };
    if (percentage >= 63) return { letter: "C", points: 2.0 };
    if (percentage >= 60) return { letter: "C-", points: 1.7 };
    if (percentage >= 57) return { letter: "D+", points: 1.3 };
    if (percentage >= 53) return { letter: "D", points: 1.0 };
    if (percentage >= 50) return { letter: "D-", points: 0.7 };

    return { letter: "F", points: 0.0 };
}

function updateGradePreview() {
    const convertedGrade = convertPercentageToGrade(gradeInput.value);

    if (gradeInput.value !== "" && !convertedGrade) {
        gradePreview.textContent = "Please enter a grade between 0 and 100.";
        return;
    }

    gradePreview.textContent = convertedGrade
        ? "Letter grade: " + convertedGrade.letter + " | GPA value: " + convertedGrade.points.toFixed(1)
        : "";
}

// 8. Add course to the selected academic year
function addCourse() {
    const yearGroup = getSelectedYearGroup();
    const convertedGrade = convertPercentageToGrade(gradeInput.value);
    const validCourse = selectedCourse && courseDatabase.find(function (course) {
        return course.code === selectedCourse.code &&
            Number(course.credits) === selectedCourse.credits;
    });

    if (!yearGroup) {
        showError("Please select an academic year.");
        academicYearInput.focus();
        return;
    }

    if (!validCourse) {
        showError("Please select a valid UofT course.");
        courseNameInput.focus();
        return;
    }

    if (!convertedGrade) {
        showError("Please enter a grade between 0 and 100.");
        gradeInput.focus();
        return;
    }

    const alreadyAdded = yearGroup.courses.some(function (course) {
        return course.code === selectedCourse.code;
    });

    if (alreadyAdded) {
        showError("This course has already been added to " + yearGroup.year + ".");
        courseNameInput.focus();
        return;
    }

    yearGroup.courses.push({
        code: selectedCourse.code,
        title: selectedCourse.title,
        credits: selectedCourse.credits,
        percentage: Number(gradeInput.value),
        letterGrade: convertedGrade.letter,
        gradePoint: convertedGrade.points
    });

    clearError();
    displayCourses();
    clearInputs();
    resetCalculatedView();
    saveData();
}

function clearInputs() {
    courseNameInput.value = "";
    gradeInput.value = "";
    gradePreview.textContent = "";
    selectedCourse = null;
    hideSuggestions();
    courseNameInput.focus();
}

// 9. Display courses grouped by academic year
function displayCourses() {
    courseTableBody.replaceChildren();

    academicYears.forEach(function (yearGroup) {
        if (yearGroup.courses.length === 0) {
            return;
        }

        const headingRow = document.createElement("tr");
        const headingCell = document.createElement("td");
        headingRow.className = "yearGroupHeader";
        headingCell.colSpan = 6;
        headingCell.textContent = yearGroup.year;
        headingRow.appendChild(headingCell);
        courseTableBody.appendChild(headingRow);

        yearGroup.courses.forEach(function (course, index) {
            const row = document.createElement("tr");
            const codeCell = document.createElement("td");
            const titleCell = document.createElement("td");
            const gradeCell = document.createElement("td");
            const creditsCell = document.createElement("td");
            const pointsCell = document.createElement("td");
            const actionCell = document.createElement("td");
            const removeButton = document.createElement("button");

            codeCell.textContent = course.code;
            titleCell.textContent = course.title;
            gradeCell.textContent = course.percentage + "% (" + course.letterGrade + ")";
            creditsCell.textContent = String(course.credits);
            pointsCell.textContent = course.gradePoint.toFixed(1);
            removeButton.type = "button";
            removeButton.textContent = "Remove";
            removeButton.setAttribute("aria-label", "Remove " + course.code + " from " + yearGroup.year);
            removeButton.addEventListener("click", function () {
                removeCourse(yearGroup.year, index);
            });

            actionCell.appendChild(removeButton);
            row.append(codeCell, titleCell, gradeCell, creditsCell, pointsCell, actionCell);
            courseTableBody.appendChild(row);
        });

        const yearGpaRow = document.createElement("tr");
        const yearGpaCell = document.createElement("td");
        yearGpaRow.className = "yearGpaRow";
        yearGpaCell.colSpan = 6;
        yearGpaCell.textContent = yearGroup.year + " GPA: " + calculateYearGPA(yearGroup.year).toFixed(2);
        yearGpaRow.appendChild(yearGpaCell);
        courseTableBody.appendChild(yearGpaRow);
    });

    if (!hasCourses()) {
        const emptyRow = document.createElement("tr");
        const emptyCell = document.createElement("td");
        emptyCell.colSpan = 6;
        emptyCell.textContent = "No courses added.";
        emptyRow.appendChild(emptyCell);
        courseTableBody.appendChild(emptyRow);
    }

}

// 10. Calculate GPA for one academic year
function calculateYearGPA(year) {
    const yearGroup = getYearGroup(year);
    if (!yearGroup || yearGroup.courses.length === 0) {
        return null;
    }

    let totalGradePoints = 0;
    let totalCredits = 0;

    yearGroup.courses.forEach(function (course) {
        totalGradePoints += course.gradePoint * course.credits;
        totalCredits += course.credits;
    });

    return totalCredits > 0 ? totalGradePoints / totalCredits : null;
}

// 11. Calculate cumulative GPA across every academic year
function calculateCumulativeGPA() {
    let totalGradePoints = 0;
    let totalCredits = 0;

    academicYears.forEach(function (yearGroup) {
        yearGroup.courses.forEach(function (course) {
            totalGradePoints += course.gradePoint * course.credits;
            totalCredits += course.credits;
        });
    });

    return totalCredits > 0 ? totalGradePoints / totalCredits : 0;
}

function displayGpaSummary() {
    yearGpaSummary.replaceChildren();

    academicYears.forEach(function (yearGroup) {
        const summaryLine = document.createElement("p");
        const yearGPA = calculateYearGPA(yearGroup.year);
        summaryLine.textContent = yearGroup.year + " GPA: " + (
            yearGPA === null ? "-" : yearGPA.toFixed(2)
        );
        yearGpaSummary.appendChild(summaryLine);
    });

    gpaResult.textContent = calculateCumulativeGPA().toFixed(2);
}

function hasCourses() {
    return academicYears.some(function (yearGroup) {
        return yearGroup.courses.length > 0;
    });
}

function showGpaSummary() {
    if (!hasCourses()) {
        showError("No courses added yet.");
        return;
    }

    clearError();
    displayGpaSummary();
    gpaSummary.classList.remove("hidden");
    toggleCoursesButton.classList.remove("hidden");
    courseListSection.classList.add("hidden");
    toggleCoursesButton.textContent = "Show Courses";
    saveData();
}

function hideGpaSummary() {
    gpaSummary.classList.add("hidden");
}

// 12. Course collapse toggle
function toggleCourseList() {
    const coursesAreHidden = courseListSection.classList.toggle("hidden");
    toggleCoursesButton.textContent = coursesAreHidden ? "Show Courses" : "Hide Courses";
    saveData();
}

function resetCalculatedView() {
    hideGpaSummary();
    courseListSection.classList.remove("hidden");
    toggleCoursesButton.textContent = "Hide Courses";
    toggleCoursesButton.classList.add("hidden");
}

// 13. Remove course
function removeCourse(year, index) {
    const yearGroup = getYearGroup(year);

    if (yearGroup && Number.isInteger(index) && index >= 0 && index < yearGroup.courses.length) {
        yearGroup.courses.splice(index, 1);
        clearError();
        displayCourses();
        resetCalculatedView();
        saveData();
    }
}

// 14. Reset calculator
function resetCalculator() {
    const shouldReset = window.confirm(
        "Are you sure you want to delete all courses and GPA data?"
    );

    if (!shouldReset) {
        return;
    }

    academicYears.forEach(function (yearGroup) {
        yearGroup.courses.length = 0;
    });

    academicYearInput.value = "1st Year";
    clearError();
    clearInputs();
    displayCourses();
    resetCalculatedView();
    clearSavedData();
}

// 15. Event listeners
document.addEventListener("DOMContentLoaded", function () {
    academicYearInput = document.getElementById("academicYear");
    courseNameInput = document.getElementById("courseName");
    gradeInput = document.getElementById("grade");
    gradePreview = document.getElementById("gradePreview");
    addCourseButton = document.getElementById("addCourseButton");
    resetButton = document.getElementById("resetButton");
    calculateGPAButton = document.getElementById("calculateGPAButton");
    toggleCoursesButton = document.getElementById("toggleCoursesButton");
    courseListSection = document.getElementById("courseListSection");
    courseTableBody = document.getElementById("courseTableBody");
    yearGpaSummary = document.getElementById("yearGpaSummary");
    gpaResult = document.getElementById("gpaResult");
    gpaSummary = document.getElementById("gpaSummary");
    errorMessage = document.getElementById("errorMessage");

    suggestionsList = document.createElement("div");
    suggestionsList.id = "courseSuggestions";
    suggestionsList.className = "course-suggestions";
    suggestionsList.setAttribute("role", "listbox");
    suggestionsList.hidden = true;
    courseNameInput.closest(".course-search-container").appendChild(suggestionsList);

    courseNameInput.addEventListener("input", handleCourseSearch);
    gradeInput.addEventListener("input", updateGradePreview);
    addCourseButton.addEventListener("click", addCourse);
    resetButton.addEventListener("click", resetCalculator);
    calculateGPAButton.addEventListener("click", showGpaSummary);
    toggleCoursesButton.addEventListener("click", toggleCourseList);
    document.addEventListener("click", function (event) {
        if (!courseNameInput.contains(event.target) && !suggestionsList.contains(event.target)) {
            hideSuggestions();
        }
    });

    const savedUiState = loadSavedData();
    academicYearInput.value = savedUiState.selectedAcademicYear;
    displayCourses();
    resetCalculatedView();

    if (savedUiState.summaryVisible && hasCourses()) {
        displayGpaSummary();
        gpaSummary.classList.remove("hidden");
        toggleCoursesButton.classList.remove("hidden");

        if (savedUiState.coursesHidden) {
            courseListSection.classList.add("hidden");
            toggleCoursesButton.textContent = "Show Courses";
        }
    }

    loadCourseDatabase();
});
