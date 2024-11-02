document.addEventListener("DOMContentLoaded", function () {
    window.scrollTo({ top: 0, behavior: "instant" });

    const scrollArrow = document.getElementById("scroll-arrow");
    const splashPage = document.getElementById("splash-page");

    if (!scrollArrow || !splashPage) {
        return;
    }
    // Scroll down to original content when arrow is clicked
    scrollArrow.addEventListener("click", () => {
        // window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
        // splashPage.style.display = "none";  // Hide the splash screen
        window.scrollTo({ top: splashPage.scrollHeight, behavior: "smooth" });
    });
});
