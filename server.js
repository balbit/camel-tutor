const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { exec, spawn } = require("child_process");
const WebSocket = require("ws");
const fs = require("fs");

const app = express();
app.use(cors({ origin: "http://camel.elliotliu.com" }));
app.use(bodyParser.json());

// Handle one-time code execution with POST
app.post("/run-code", (req, res) => {
    const { code } = req.body;

    // Save code to a temporary file
    fs.writeFileSync("/tmp/code.ml", code);

    // Execute OCaml code once
    exec(`echo "${code}" | utop`, (error, stdout, stderr) => {
        if (error || stderr) {
            return res.json({ output: stderr || error.message });
        }
        res.json({ output: stdout });
    });
});

const server = app.listen(3000, () => console.log("Server running on port 3000"));
// Set up WebSocket server for live `utop` interaction
const wss = new WebSocket.Server({ server, path: "/playground/ws" });

wss.on("connection", (ws) => {
    console.log("WebSocket client connected");

    // Spawn `utop` process
    const utopProcess = spawn("utop");

    // Send `utop` output to WebSocket client
    utopProcess.stdout.on("data", (data) => {
        ws.send(data.toString());
    });

    utopProcess.stderr.on("data", (data) => {
        ws.send(data.toString());
    });

    // Receive code from WebSocket client and send it to `utop`
    ws.on("message", (message) => {
        utopProcess.stdin.write(message + "\n");
    });

    // Clean up `utop` process on WebSocket disconnect
    ws.on("close", () => {
        console.log("WebSocket client disconnected");
        utopProcess.kill();
    });
});
