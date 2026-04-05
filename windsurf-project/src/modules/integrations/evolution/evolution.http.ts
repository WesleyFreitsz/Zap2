import axios from "axios";
import { env } from "../../../config/env";
import { logger } from "../../../utils/logger";

export const evolutionApi = axios.create({
  baseURL: env.EVOLUTION_API_URL,
  headers: {
    "Content-Type": "application/json",
    apikey: env.EVOLUTION_API_KEY,
  },
  timeout: 30000,
});

evolutionApi.interceptors.request.use(
  (config) => {
    logger.info(
      `[Evolution HTTP] ${config.method?.toUpperCase()} ${config.url}`,
    );
    return config;
  },
  (error) => {
    logger.error(`[Evolution HTTP] Request error: ${error.message}`);
    return Promise.reject(error);
  },
);

evolutionApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status || "N/A";
    const data = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message;
    logger.error(`[Evolution HTTP] Response error [${status}]: ${data}`);
    return Promise.reject(error);
  },
);
