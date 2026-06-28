import { spawn } from "node:child_process";
import net from "node:net";

function canUsePort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "0.0.0.0");
  });
}

async function findOpenPort(startPort) {
  let port = startPort;
  while (!(await canUsePort(port))) {
    port += 1;
  }
  return port;
}

const apiPort = await findOpenPort(Number(process.env.PORT || 4000));
const webPort = await findOpenPort(Number(process.env.WEB_PORT || 5173));

const processes = [
  {
    name: "api",
    command: "npm",
    args: ["run", "dev:api"],
    env: { ...process.env, PORT: String(apiPort) }
  },
  {
    name: "web",
    command: "npm",
    args: ["run", "dev:web", "--", "--port", String(webPort)],
    env: { ...process.env, API_PORT: String(apiPort), WEB_PORT: String(webPort) }
  }
];

console.log(`Starting Logithon CaseOps with API on ${apiPort} and web on ${webPort}`);

const children = processes.map(({ name, command, args, env }) => {
  const child = spawn(command, args, {
    env,
    stdio: ["inherit", "pipe", "pipe"],
    shell: process.platform === "win32"
  });

  child.stdout.on("data", (data) => process.stdout.write(`[${name}] ${data}`));
  child.stderr.on("data", (data) => process.stderr.write(`[${name}] ${data}`));
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[${name}] exited with code ${code}`);
    }
  });

  return child;
});

const shutdown = () => {
  children.forEach((child) => child.kill("SIGTERM"));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
