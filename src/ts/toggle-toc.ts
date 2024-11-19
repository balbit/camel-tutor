document.addEventListener("DOMContentLoaded", () => {
  // Function to initialize the enhanced <li> elements
  const enhanceListItems = () => {
    const tocSections = document.querySelectorAll(".index-toc");

    tocSections.forEach((section, sectionIndex) => {
      const ulElements = section.querySelectorAll("ul");

      ulElements.forEach((ul, ulIndex) => {
        const listItems = ul.querySelectorAll("li");

        listItems.forEach((li, liIndex) => {
          const key = `toc-li-${sectionIndex}-${ulIndex}-${liIndex}`;
          const isCompleted = localStorage.getItem(key) === "true";

          // Add a class to denote completion
          li.classList.add(isCompleted ? "completed" : "incomplete");

          const lastOpenedKey = `toc-last-opened-${sectionIndex}-${ulIndex}-${liIndex}`;
          const finishedKey = `toc-finished-${sectionIndex}-${ulIndex}-${liIndex}`;

          const lastOpenedDate = localStorage.getItem(lastOpenedKey);
          const finishedDate = localStorage.getItem(finishedKey);

          // Create label element
          const dateLabel = document.createElement("span");
          dateLabel.textContent = finishedDate
            ? `${new Date(finishedDate).toLocaleDateString()}`
            : lastOpenedDate
            ? `${new Date(lastOpenedDate).toLocaleDateString()}`
            : "";

          const link = li.querySelector("a");
          if (link) {
            link.addEventListener("click", () => {
              const now = new Date().toISOString();
              localStorage.setItem(lastOpenedKey, now);
              dateLabel.textContent = `Last opened: ${new Date(now).toLocaleDateString()}`;
            });
          }

          // Create a subtle button
          const button = document.createElement("button");
          button.innerHTML = isCompleted ? "✔" : "";;
          button.classList.add("completion-button");

          // Add hover behavior for the button
          button.style.opacity = "0"; // Hidden by default
          button.style.transition = "opacity 0.3s";

          li.addEventListener("mouseover", () => {
            button.style.opacity = "1"; // Show button on hover
          });
          li.addEventListener("mouseout", () => {
            button.style.opacity = "0"; // Hide button when not hovered
          });

          // Add event listener to button
          button.addEventListener("click", () => {
            const currentlyCompleted = li.classList.contains("completed");
            const now = new Date().toISOString();
          
            if (currentlyCompleted) {
              li.classList.remove("completed");
              li.classList.add("incomplete");
              button.innerHTML = ""; // Empty square for incomplete
              localStorage.setItem(key, "false");
              localStorage.removeItem(finishedKey); // Remove finished date
              dateLabel.textContent = `Last opened: ${new Date(localStorage.getItem(lastOpenedKey) || now).toLocaleDateString()}`;
            } else {
              li.classList.remove("incomplete");
              li.classList.add("completed");
              button.innerHTML = "✔"; // Checkmark for completed
              localStorage.setItem(key, "true");
              localStorage.setItem(finishedKey, now);
              dateLabel.textContent = `Finished: ${new Date(now).toLocaleDateString()}`;
            }
          });

          // Add the button to the <li>
          dateLabel.style.marginRight = "auto";
          dateLabel.style.fontSize = "12px";
          dateLabel.style.color = "#666";

          li.style.display = "flex";
          li.style.alignItems = "right";
          li.style.gap = "8px";

          li.appendChild(dateLabel);
          li.appendChild(button);
        });
      });
    });
  };

  enhanceListItems();
});
