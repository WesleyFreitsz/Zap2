import { Request, Response, NextFunction } from "express";
import { wppConnectService } from "./wppconnect.service";
import { AppError } from "../../../utils/AppError";

function getCompanyId(req: Request): string {
  const companyId = req.user?.companyId;
  if (!companyId) {
    throw new AppError(
      "Usuário não está associado a uma empresa. Faça login com um usuário de empresa.",
      400,
    );
  }
  return companyId;
}

export class WppConnectController {
  async connect(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const { label } = req.body;
      const result = await wppConnectService.createSession(companyId, label);
      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async sessions(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const result = await wppConnectService.listSessions(companyId);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async status(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const integrationId = req.params.integrationId as string;
      const result = await wppConnectService.getSessionStatus(integrationId);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async qrCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const integrationId = req.params.integrationId as string;
      const result = await wppConnectService.getQrCode(integrationId);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async reconnect(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const integrationId = req.params.integrationId as string;
      const result = await wppConnectService.reconnect(integrationId);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async disconnect(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const integrationId = req.params.integrationId as string;
      const result = await wppConnectService.disconnect(integrationId);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async sendMessage(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const { phone, message, integrationId } = req.body;
      let result;
      if (integrationId) {
        result = await wppConnectService.sendMessage(
          integrationId,
          phone,
          message,
        );
      } else {
        result = await wppConnectService.sendMessageAuto(
          companyId,
          phone,
          message,
        );
      }
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async sendMedia(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const { number, type, url, base64, caption, fileName, integrationId } =
        req.body;
      if (!number || !type) {
        throw new AppError("number and type are required", 400);
      }
      const options = { number, type, url, base64, caption, fileName };
      let result;
      if (integrationId) {
        result = await wppConnectService.sendMedia(integrationId, options);
      } else {
        result = await wppConnectService.sendMediaAuto(companyId, options);
      }
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
}
