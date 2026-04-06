import axios from "axios";
import { env } from "./env";
import { logger } from "../utils/logger";

const ASAAS_API_URL = env.ASAAS_API_URL;
const ASAAS_API_KEY = env.ASAAS_API_KEY;

export const asaasApi = axios.create({
  baseURL: ASAAS_API_URL,
  headers: {
    "Content-Type": "application/json",
    access_token: ASAAS_API_KEY,
  },
  timeout: 30000,
});

asaasApi.interceptors.request.use(
  (config) => {
    logger.info(`[Asaas] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    logger.error(`[Asaas] Request error: ${error.message}`);
    return Promise.reject(error);
  },
);

asaasApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status || "N/A";
    const data = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message;
    logger.error(`[Asaas] Response error [${status}]: ${data}`);
    return Promise.reject(error);
  },
);
