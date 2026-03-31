import "dotenv/config";
import { parse } from "url";
import express from "express";
import next from "next";
import { mainRouter } from "./backend";
import { prisma } from "./backend/lib/prisma";
import { bot } from "./backend/lib/grammy";

const environment = process.env.NODE_ENV ?? "development";
const port = process.env.PORT;
const hostname = process.env.HOSTNAME;

// Initialize Next.js
const nextApp = next({ dev: environment !== "production" });
const handle = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
  const server = express();

  // OWASP security response headers (required by Zoom Home URL)
  server.use((_req, res, next) => {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'self' https://*.zoom.us;");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  bot.start();

  server.use("/api", mainRouter);

  server.all("/{*any}", (req, res) => {
    const parsedUrl = parse(req.url!, true);
    if (parsedUrl.pathname?.startsWith("/socket.io/")) {
      return;
    }
    return handle(req, res, parsedUrl);
  });

  const httpServer = server.listen(port, () => {
    console.info(
      `🌐 Server ready at (http://${hostname}:${port}) on ${environment} environment`,
    );
  });

  const gracefulShutdown = async (signal: string) => {
    console.info(`\nReceived ${signal}. Starting graceful shutdown...`);

    try {
      console.info("Stopping Telegram bot...");
      await bot.stop();
      console.info("Telegram bot stopped.");

      console.info("Closing HTTP server...");
      httpServer.close(async () => {
        console.info("HTTP server closed.");

        console.info("Disconnecting Prisma...");
        await prisma.$disconnect();
        console.info("Prisma disconnected.");

        console.info("Graceful shutdown completed.");
        process.exit(0);
      });

      // Force exit if server doesn't close within 10 seconds
      setTimeout(() => {
        console.error(
          "Could not close connections in time, forcefully shutting down.",
        );
        process.exit(1);
      }, 10000);
    } catch (err) {
      console.error("Error during graceful shutdown:", err);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
});
