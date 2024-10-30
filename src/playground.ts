document.addEventListener("DOMContentLoaded", function () {
    const terminalOutput = document.getElementById("terminal-output");
    const terminalInput = document.getElementById("terminal-input") as HTMLInputElement | null;

    if (!terminalOutput || !terminalInput) {
        console.error("Missing required elements");
        return;
    }

    // Connect to WebSocket server
    const socket = new WebSocket("ws://camel.elliotliu.com/playground/ws");

    // Display messages from the WebSocket server
    socket.addEventListener("message", function (event) {
        terminalOutput.textContent += event.data + "\n";
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    });

    // Send user input to the WebSocket server on Enter key press
    terminalInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            const message = terminalInput.value;
            terminalInput.value = "";
            socket.send(message);
            terminalOutput.textContent += "> " + message + "\n";
        }
    });

    // Handle WebSocket errors
    socket.addEventListener("error", (error) => {
        terminalOutput.textContent += "Connection error. Please try again later.\n";
    });
});
