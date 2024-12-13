function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "") // Remove special characters
        .trim() // Remove beginning and trailing spaces
        .replace(/\s+/g, " ") // Replace consecutive spaces with a single space
        .split(/\s+/) // Split into words
        .slice(0, 6) // Take the first 6 words
        .join("-");
}

function getElementId(element: HTMLElement): string {
    const tag = element.tagName.toLowerCase();
    const className = element.className ? element.className.split(" ").join("-") : "";
    const textContent = element.textContent || element.innerText || "";
    const normalizedText = normalizeText(textContent);
    return [tag, className, normalizedText].filter(Boolean).join("-");
}

// Function to scroll to an element and center it on the page
export function scrollToHash(): void {
    const hash = window.location.hash.substring(1); // Get the hash without "#"
    if (!hash) return;

    const elements = document.querySelectorAll<HTMLElement>("p, h1, h2, h3, h4, div.highlight");

    for (const element of elements) {
        const elementId = getElementId(element);

        if (elementId === hash) {
            element.scrollIntoView({ behavior: "smooth", block: "center" }); // Center the element in the viewport
            element.style.backgroundColor = "#ffffcc"; // Highlight the element
            setTimeout(() => {
                element.style.backgroundColor = ""; // Remove highlight after 2 seconds
            }, 3500);
            break;
        }
    }
}

function injectAnchorLinks(): void {
    const elements = document.querySelectorAll<HTMLElement>("p, h1, h2, h3, h4, div.highlight");

    elements.forEach((element) => {
        const elementId = getElementId(element);

        if (elementId) {
            // Create the anchor link
            const anchor = document.createElement("a");
            anchor.href = `#${elementId}`;
            anchor.textContent = "#";
            anchor.style.position = "absolute";
            anchor.style.left = "-2em"; // Position in the left margin
            anchor.style.textDecoration = "none";
            anchor.style.opacity = "0"; // Hidden by default
            anchor.style.transition = "opacity 0.2s";

            // Prevent page reload and manually scroll to the element
            anchor.addEventListener("click", (event) => {
                event.preventDefault(); // Prevent default link behavior
                window.history.pushState(null, "", `#${elementId}`); // Update URL hash
                scrollToHash(); // Manually scroll to the element
            });

            element.style.position = "relative";
            element.appendChild(anchor);
        }
    });
}

// Function to manage the visibility of "#" links when mouse is in the left margin
function setupMarginHover(): void {
    const level1Section = document.querySelector<HTMLElement>("section.level1");
    if (!level1Section) return;

    document.addEventListener("mousemove", (event) => {
        const leftMarginEnd = level1Section.getBoundingClientRect().left;

        const anchors = document.querySelectorAll<HTMLElement>("a[href^='#']:not([href^='#scrollNav'])");
        if (event.clientX < leftMarginEnd) {
            // Mouse is in the left margin; show all anchors
            anchors.forEach((anchor) => {
                anchor.style.opacity = "1";
            });
        } else {
            // Mouse is outside the left margin; hide all anchors
            anchors.forEach((anchor) => {
                anchor.style.opacity = "0";
            });
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    injectAnchorLinks();
    setupMarginHover();
    // scrollToHash();
});