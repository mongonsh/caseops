import { spawn } from "node:child_process";

const processes = [
  { name: "api", command: "npm", args: ["run", "dev:api"] },
  { name: "web", command: "npm", args: ["run", "dev:web"] }
];

const children = processes.map(({ name, command, args }) => {
  const child = spawn(command, args, {
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
