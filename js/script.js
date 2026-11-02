
// Get inquiry modal elements
const inquiryModal = document.getElementById("inquiryModal");
const openInquiry = document.getElementById("openInquiry");
const closeInquiry = document.getElementById("closeInquiry");

const inquirySelection = document.getElementById("inquirySelection");
const inquiryOptions = document.querySelectorAll(".inquiry-option");
const inquiryNext = document.getElementById("inquiryNext");

// Get the three inquiry forms
const tourInquiryForm = document.getElementById("tourInquiryForm");
const generalInquiryForm = document.getElementById("generalInquiryForm");
const customInquiryForm = document.getElementById("customInquiryForm");

// Store selected inquiry type
let selectedInquiry = "";

// All inquiry forms
const inquiryForms = [
    tourInquiryForm,
    generalInquiryForm,
    customInquiryForm
];

// Open inquiry modal
openInquiry.addEventListener("click", function (event) {
    event.preventDefault();

    inquiryModal.classList.add("active");
    document.body.style.overflow = "hidden";
});

// Close inquiry modal
closeInquiry.addEventListener("click", closeModal);

// Close modal when clicking outside
inquiryModal.addEventListener("click", function (event) {
    if (event.target === inquiryModal) {
        closeModal();
    }
});

// Close and reset modal
function closeModal() {
    inquiryModal.classList.remove("active");
    document.body.style.overflow = "";

    inquirySelection.style.display = "block";

    inquiryForms.forEach(function (form) {
        form.style.display = "none";
    });

    inquiryOptions.forEach(function (option) {
        option.classList.remove("selected");
    });

    selectedInquiry = "";
    inquiryNext.disabled = true;
}

// Select inquiry option
inquiryOptions.forEach(function (option) {

    option.addEventListener("click", function () {

        // Remove previous selection
        inquiryOptions.forEach(function (item) {
            item.classList.remove("selected");
        });

        // Highlight selected option
        option.classList.add("selected");

        // Save selected inquiry type
        selectedInquiry = option.dataset.type;

        // Enable Next button
        inquiryNext.disabled = false;
    });

});

// Next button
inquiryNext.addEventListener("click", function () {

    if (selectedInquiry === "") {
        return;
    }

    // Hide selection screen
    inquirySelection.style.display = "none";

    // Hide all forms first
    inquiryForms.forEach(function (form) {
        form.style.display = "none";
    });

    // Show selected form
    if (selectedInquiry === "tour") {
        tourInquiryForm.style.display = "block";
    }

    else if (selectedInquiry === "general") {
        generalInquiryForm.style.display = "block";
    }

    else if (selectedInquiry === "custom") {
        customInquiryForm.style.display = "block";
    }

});

// Back buttons
const backButtons = document.querySelectorAll(".inquiry-back");

backButtons.forEach(function (button) {

    button.addEventListener("click", function () {

        // Hide all forms
        inquiryForms.forEach(function (form) {
            form.style.display = "none";
        });

        // Return to selection screen
        inquirySelection.style.display = "block";

    });

});

// Prevent forms from refreshing the page
const inquiryFormElements = document.querySelectorAll(
    "#tourForm, #generalForm, #customForm"
);

inquiryFormElements.forEach(function (form) {

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        alert("Your form is ready! Actual inquiry submission is not connected yet.");
    });

});
