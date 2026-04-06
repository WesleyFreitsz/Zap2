import app from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import prisma from "./config/prisma";
import AiTemperatureScheduler from "./schedulers/ai-temperature.scheduler";

async function bootstrap() {
  try {
    await prisma.$connect();
    logger.info("Database connected successfully");

    // Iniciar scheduler de IA de temperatura
    const aiScheduler = new AiTemperatureScheduler();
    aiScheduler.start();

    // Check WhatsApp instances on startup
    try {
      const { wppConnectService } =
        await import("./modules/integrations/wppconnect/wppconnect.service");
      await wppConnectService.restoreSessionsOnStartup();
    } catch (err) {
      logger.warn(
        `[Startup] WPPConnect session restore skipped: ${(err as Error).message}`,
      );
    }

    app.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
      logger.info(`Health check: http://localhost:${env.PORT}/health`);
      logger.info(`API base: http://localhost:${env.PORT}/api`);
      logger.info(`🤖 AI Temperature Scheduler started`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  logger.info("Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

bootstrap();
