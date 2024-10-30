const express = require("express");
const bodyParser = require("body-parser");
const { exec } = require("child_process");

const app = express();
app.use(bodyParser.json());

app.post("/run-code", (req, res) => {
    const { code } = req.body;

    // Save code to a temporary file
    const fs = require("fs");
    fs.writeFileSync("/tmp/code.ml", code);

    // Execute OCaml code
    exec("ocaml /tmp/code.ml", (error, stdout, stderr) => {
        if (error || stderr) {
            return res.json({ output: stderr || error.message });
        }
        res.json({ output: stdout });
    });
});

app.listen(3000, () => console.log("Server running on port 3000"));