const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { exec, spawn } = require("child_process");
const WebSocket = require("ws");
const fs = require("fs");
const Docker = require("dockerode");
const docker = new Docker();
const stream = require("stream");

const app = express();
app.use(cors({ origin: "http://camel.elliotliu.com" }));
app.use(bodyParser.json());

const userSessions = new Map();

// Cleanup interval (milliseconds)
const INACTIVITY_TIMEOUT = 10 * 60 * 1000;

async function getOrCreateContainer(sessionId) {
    if (userSessions.has(sessionId)) {
        const session = userSessions.get(sessionId);
        session.lastAccess = Date.now();
        return session;
    }

    const container = await docker.createContainer({
        Image: "ocaml-utop-fixed",
        Tty: true,
        OpenStdin: true,
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Cmd: ["sleep", "infinity"],

        HostConfig: {
            NetworkMode: "none",
        },
    
        User: "1000"
    });
    await container.start();

    const exec = await container.exec({
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        Cmd: ["opam", "exec", "--", "/home/opam/.opam/5.2.0/bin/utop"]
    });

    const execStream = await exec.start({ hijack: true, stdin: true });
    const inputStream = new stream.PassThrough();
    inputStream.pipe(execStream);

    userSessions.set(sessionId, {
        container,
        execStream,
        inputStream,
        lastAccess: Date.now()
    });

    return { container, execStream, inputStream };
}

function removeCtrlChars(str) {
    return str
        .replace(/\r/g, "")
        .replace(/\u0000|\u0001|\u0018|\u001b|\u001c|\u001d|\[1;35m|\[1m|\[0m/g, ""); // Remove unwanted control characters
}


function cleanOutput(output) {
    const knownPatterns = ["val", "-", "module", "Warning", "Error", "If", "let"];
    const lines = output.split("\n");

    const cleanedLines = lines.map((line) => {
        // Check if removing the first character results in a known pattern
        if (line.length > 1) {
            const possibleMatch = line.slice(1);
            if (knownPatterns.some((pattern) => possibleMatch.startsWith(pattern))) {
                return possibleMatch;
            }
        }
        if (line.length == 1) {
            return "";
        }
        return line;
    });

    // Join cleaned lines back into a single string
    return cleanedLines.join("\n");
}

app.post("/run-code", async (req, res) => {
    const { code, sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ error: "Session ID required" });
    }

    try {
        newContainer = !userSessions.has(sessionId);

        const session = await getOrCreateContainer(sessionId);
        session.lastAccess = Date.now();

        session.execStream.removeAllListeners("data");

        session.inputStream.write(`${code}\n`);

        let output = "";
        session.execStream.on("data", (data) => {
            // Convert stream data to string, remove specific unwanted characters, and append to output
            output += data.toString()
        });

        setTimeout(() => {
            const cleanedOutput = removeCtrlChars(output);

            res.json({ output: cleanOutput(cleanedOutput).trim() }); // Trim any extra whitespace
        }, 1000);
    } catch (error) {
        res.status(500).json({ error: "Execution error: " + error.message });
    }
});

// Cleanup function to remove inactive containers
function cleanupInactiveContainers() {
    const now = Date.now();
    userSessions.forEach(async (session, sessionId) => {
        if (now - session.lastAccess > INACTIVITY_TIMEOUT) {
            try {
                await session.container.stop();
                await session.container.remove();
                userSessions.delete(sessionId);
                console.log(`Removed inactive container for session ${sessionId}`);
            } catch (error) {
                console.error("Error cleaning up container:", error.message);
            }
        }
    });
}

setInterval(cleanupInactiveContainers, INACTIVITY_TIMEOUT / 2);

const server = app.listen(3000, () => console.log("Server running on port 3000"));
// Set up WebSocket server for live `utop` interaction
const wss = new WebSocket.Server({ server, path: "/playground/ws" });


wss.on("connection", async (ws) => {
    console.log("WebSocket client connected");

    // Create a new container running `utop`
    const container = await docker.createContainer({
        Image: "ocaml-utop-fixed", // Replace with the appropriate Docker image for `utop`
        Tty: true,
        OpenStdin: true,
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Cmd: ["sleep", "infinity"],

        HostConfig: {
            NetworkMode: "none",
            // Setting up resource limits makes container spin up slower by several seconds
            // Memory: 256 * 1024 * 1024, // Limit memory to 256MB
            // CpuQuota: 100000, // Limit CPU usage to 1 CPU (100000 microseconds of CPU time per 100000 microseconds)
        },
    
        User: "1000"
    });

    ws.send("Creating your OCaml playground...");

    await container.start();

    // Attach to the container’s `utop` output streams
    const exec = await container.exec({
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        Cmd: ["opam", "exec", "--", "/home/opam/.opam/5.2.0/bin/utop"]
    });

    const execStream = await exec.start({ hijack: true, stdin: true });

    let userHasInput = false;
    let streamStarted = false;

    // Stream output from `utop` in the container to the WebSocket client
    execStream.on("data", (data) => {
        output = data.toString();
        output = removeCtrlChars(output);
        output = cleanOutput(output);
        if (!streamStarted) {
            ws.send("Sandbox created!\n");
            streamStarted = true;
        }
        if (userHasInput) {
            ws.send(output);
        } else {
            ws.send(output.trim());
        }
    });

    // Send messages from the WebSocket client to the `utop` process in the container
    ws.on("message", (message) => {
        userHasInput = true;
        execStream.write(`${message}\n`);
    });

    // Clean up the container when the WebSocket connection closes
    ws.on("close", async () => {
        console.log("WebSocket client disconnected");
        execStream.end(); // End the input stream to the exec
        await container.stop();
        await container.remove();
    });

    // Error handling for the WebSocket and Docker container
    ws.on("error", async (error) => {
        console.error("WebSocket error:", error);
        await container.stop();
        await container.remove();
    });
});
