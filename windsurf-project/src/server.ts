import app from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import prisma from "./config/prisma";

async function bootstrap() {
  try {
    await prisma.$connect();
    logger.info("Database connected successfully");

    // Check WhatsApp instances on startup
    try {
      const { EvolutionService } =
        await import("./modules/integrations/evolution/evolution.service");
      const evolutionService = new EvolutionService();
      await evolutionService.checkInstancesOnStartup();
    } catch (err) {
      logger.warn(
        `[Startup] Evolution instance check skipped: ${(err as Error).message}`,
      );
    }

    app.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
      logger.info(`Health check: http://localhost:${env.PORT}/health`);
      logger.info(`API base: http://localhost:${env.PORT}/api`);
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
