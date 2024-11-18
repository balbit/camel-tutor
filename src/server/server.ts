import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { exec, spawn } from "child_process";
import WebSocket, { Server as WebSocketServer } from "ws";
import fs from "fs";
import Dockerode from "dockerode";
import stream from "stream";

const docker = new Dockerode();

const app = express();
app.use(cors({ origin: "http://camel.elliotliu.com" }));
app.use(bodyParser.json());

interface UserSession {
   container: Promise<ContainerInfo>;
   lastAccess: number;
}

interface ContainerInfo {
   container: Dockerode.Container;
   execStream: NodeJS.ReadWriteStream;
   inputStream: stream.PassThrough;
}

interface RunCodeRequestBody {
   code: string;
   sessionId: string;
}

const userSessions = new Map<string, UserSession>();

const INACTIVITY_TIMEOUT = 10 * 60 * 1000;

async function createSecureContainer(): Promise<Dockerode.Container> {
   return docker.createContainer({
      Image: "ocaml-utop-fixed",
      Tty: true,
      OpenStdin: true,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Cmd: ["sleep", "infinity"],
      User: "1000", // Non-root user
      HostConfig: {
      //   CpuShares: 512, // Relative CPU weight
        Memory: 512 * 1024 * 1024,
        MemorySwap: 1024 * 1024 * 1024,
        PidsLimit: 50, // Maximum number of processes
      //   AutoRemove: true,
      //   NetworkMode: 'none',
      },
   });
}

async function createLiveUtopStream(): Promise<ContainerInfo> {
   const container = await createSecureContainer();

   await container.start();

   const execInstance = await container.exec({
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Cmd: ["opam", "exec", "--", "/home/opam/.opam/5.2.0/bin/utop"],
   });

   const execStream = (await execInstance.start({
      hijack: true,
      stdin: true,
   })) as NodeJS.ReadWriteStream;

   const inputStream = new stream.PassThrough();
   inputStream.pipe(execStream);

   // Wait until utop is spun up, indicated by the output
   // Type #utop_help for help about using utop.

   await new Promise((resolve) => {
      execStream.on("data", (data) => {
         const output = data.toString();
         if (output.includes("Type #utop_help for help about using utop.")) {
            resolve(true);
         }
      });
   });

   execStream.removeAllListeners("data");

   // Wait just a bit more to make sure utop is ready
   await new Promise((resolve) => setTimeout(resolve, 300));

   return { container, execStream, inputStream };
}

async function getOrCreateContainer(sessionId: string): Promise<UserSession> {
   if (userSessions.has(sessionId)) {
      const session = userSessions.get(sessionId)!;
      session.lastAccess = Date.now();
      return session;
   }

   const session = {
      container: createLiveUtopStream(),
      lastAccess: Date.now(),
   };

   userSessions.set(sessionId, session);

   return session;
}

function removeCtrlChars(str: string): string {
   return str
      .replace(/\r/g, "")
      .replace(
         /\u0000|\u0001|\u0018|\u001b|\u001c|\u001d|\[1;35m|\[1m|\[0m/g,
         ""
      );
}

function cleanOutput(output: string): string {
   const knownPatterns = [
      "val",
      "-",
      "module",
      "Warning",
      "Error",
      "Line",
      "If",
      "let",
      "type",
   ];
   const lines = output.split("\n");

   const cleanedLines = lines.map((line) => {
      if (line.length > 1) {
         const possibleMatch = line.slice(1);
         if (knownPatterns.some((pattern) => possibleMatch.startsWith(pattern))) {
            return possibleMatch;
         }
      }
      if (line.length === 1) {
         return "";
      }
      return line;
   });

   return cleanedLines.join("\n");
}

function sendCodeAndCollectOutput(
     info: ContainerInfo,
     code: string
 ): Promise<string> {
     return new Promise((resolve, reject) => {
         let output = "";
         let dataTimer: NodeJS.Timeout | null = null;
         let firstDataTimeout: NodeJS.Timeout | null = null;
         const startTime = Date.now();
 
         const onData = (data: Buffer) => {
             if (firstDataTimeout) {
                 clearTimeout(firstDataTimeout);
                 firstDataTimeout = null;
             }
 
             output += data.toString();
 
             if (dataTimer) {
                 clearTimeout(dataTimer);
             }
             
             const elapsed = Date.now() - startTime;
             dataTimer = setTimeout(finishCollecting, elapsed * 0.3);
         };
 
         const finishCollecting = () => {
             info.execStream.removeListener("data", onData);
 
             if (dataTimer) {
                 clearTimeout(dataTimer);
                 dataTimer = null;
             }
             if (firstDataTimeout) {
                 clearTimeout(firstDataTimeout);
                 firstDataTimeout = null;
             }
 
             const cleanedOutput = removeCtrlChars(output);
             resolve(cleanOutput(cleanedOutput).trim());
         };
 
         firstDataTimeout = setTimeout(() => {
            info.execStream.removeListener("data", onData);
   
            if (dataTimer) {
               clearTimeout(dataTimer);
               dataTimer = null;
            }

            // Send a Ctrl+C to terminate the process
            info.inputStream.write('\x03');

            setTimeout(() => {resolve("(no output / terminated)")}, 100);
          }, 5000);
 
         info.execStream.on("data", onData);
         info.inputStream.write(`${code}\n`);
     });
 }

app.post("/run-code", async (req: any, res: any) => {
   const { code, sessionId } = req.body as RunCodeRequestBody;

   if (!sessionId) {
      return res.status(400).json({ error: "Session ID required" });
   }

   try {
      const session = await getOrCreateContainer(sessionId);
      session.lastAccess = Date.now();

      const info = await session.container;

      // const output = await sendCodeAndCollectOutput(info, code);
      const codeChunks = code.split(";;").map(chunk => chunk.trim()).filter(chunk => chunk.length > 0);
      let finalOutput = "";

      for (const chunk of codeChunks) {
         const chunkOutput = await sendCodeAndCollectOutput(info, `${chunk};;`);
         finalOutput += chunkOutput + "\n";
      }

      res.json({ output: finalOutput.trim() });
   } catch (error) {
      res
         .status(500)
         .json({ error: "Execution error: " + (error as Error).message });
   }
});

// Cleanup function to remove inactive containers
function cleanupInactiveContainers() {
   const now = Date.now();
   userSessions.forEach(async (session, sessionId) => {
      if (now - session.lastAccess > INACTIVITY_TIMEOUT) {
         try {
            const info = await session.container;
            await info.container.stop();
            await info.container.remove();
            userSessions.delete(sessionId);
            console.log(`Removed inactive container for session ${sessionId}`);
         } catch (error) {
            console.error("Error cleaning up container:", (error as Error).message);
         }
      }
   });
}

setInterval(cleanupInactiveContainers, INACTIVITY_TIMEOUT / 2);

const server = app.listen(3000, () =>
   console.log("Server running on port 3000")
);

// Set up WebSocket server for live `utop` interaction
const wss = new WebSocketServer({ server, path: "/playground/ws" });

wss.on("connection", async (ws: WebSocket) => {
   console.log("WebSocket client connected");

   // Create a new container running `utop`
   const container = await createSecureContainer();

   ws.send("Creating your OCaml playground...");

   await container.start();

   // Attach to the container’s `utop` output streams
   const execInstance = await container.exec({
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Cmd: ["opam", "exec", "--", "/home/opam/.opam/5.2.0/bin/utop"],
   });

   const execStream = (await execInstance.start({
      hijack: true,
      stdin: true,
   })) as NodeJS.ReadWriteStream;

   let userHasInput = false;
   let streamStarted = false;

   let executionTimer: NodeJS.Timeout | null = null;
   let graceTimer: NodeJS.Timeout | null = null;

   let PROBE_STRING = "let camelTutor_playground_probe = 42;;";
   function isProbeOutput(output: string): boolean {
      return output.includes("camelTutor_playground_probe");
   }

   /**
    * Sends SIGINT (Ctrl+C) to the `utop` process after MAX_EXECUTION_TIME.
    * If `utop` does not terminate within GRACE_PERIOD, the container is forcefully killed.
    */
   const startExecutionTimer = () => {
      const MAX_EXECUTION_TIME = 10000;
      const GRACE_PERIOD = 5000;

      if (executionTimer) {
         clearTimeout(executionTimer);
      }

      executionTimer = setTimeout(async () => {
         ws.send("Warning: Execution time exceeded 10 seconds. Attempting to terminate the process...");

         // Send Ctrl+C to `utop` by writing '\x03' to the execStream's stdin
         execStream.write('\x03');

         // wait 1s and send a probe to check if the process is still running
         setTimeout(() => {
            execStream.write(`${PROBE_STRING}\n`);
         }, 1000);

         // Start grace period timer
         graceTimer = setTimeout(async () => {
            ws.send("Error: Process did not terminate gracefully. Terminating your session.\nPlease reload CamelTutor Playground to start a new session.");
            execStream.end(); // End the input stream to `utop`
            try {
               await container.kill();
               await container.remove();
               ws.close();
            } catch (err) {
               console.error("Error terminating container:", err);
            }
         }, GRACE_PERIOD);
      }, MAX_EXECUTION_TIME);
   };

   const clearTimers = () => {
      if (executionTimer) {
         clearTimeout(executionTimer);
         executionTimer = null;
      }
      if (graceTimer) {
         clearTimeout(graceTimer);
         graceTimer = null;
      }
   };

   // Stream output from `utop` in the container to the WebSocket client
   execStream.on("data", (data: Buffer) => {
      let output = data.toString();
      output = removeCtrlChars(output);
      output = cleanOutput(output);
      if (!streamStarted) {
         ws.send("Sandbox created!\n");
         streamStarted = true;
      }
      clearTimers();
      if (isProbeOutput(output)) {
         return;
      }
      if (userHasInput) {
         ws.send(output);
      } else {
         ws.send(output.trim());
      }
   });

   // Send messages from the WebSocket client to the `utop` process in the container
   ws.on("message", (message: WebSocket.Data) => {
      userHasInput = true;
      let msg: string;
      if (typeof message === "string") {
         msg = message;
      } else if (message instanceof Buffer) {
         msg = message.toString();
      } else {
         // Handle other types if necessary
         msg = "";
      }
      // if msg has ';;', then mark it as an execution and start the timer
      if (msg.includes(";;")) {
         startExecutionTimer();
      }
      execStream.write(`${msg}\n`);
   });

   // Clean up the container when the WebSocket connection closes
   ws.on("close", async () => {
      console.log("WebSocket client disconnected");
      execStream.end(); // End the input stream to the exec
      await container.stop();
      await container.remove();
   });

   // Error handling for the WebSocket and Docker container
   ws.on("error", async (error: Error) => {
      console.error("WebSocket error:", error);
      await container.stop();
      await container.remove();
   });
});
