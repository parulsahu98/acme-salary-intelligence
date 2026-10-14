import { app } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./db.js";

const server = app.listen(config.PORT, () => {
  console.info(`ACME Salary Intelligence API listening on port ${config.PORT}`);
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`Received ${signal}; shutting down.`);
  server.close(async (error) => {
    await prisma.$disconnect();
    if (error) {
      console.error("HTTP server shutdown failed.");
      process.exitCode = 1;
    }
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
