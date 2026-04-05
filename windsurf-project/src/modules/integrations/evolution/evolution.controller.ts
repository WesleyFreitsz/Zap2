import { Request, Response, NextFunction } from "express";
import { EvolutionService } from "./evolution.service";
import { AppError } from "../../../utils/AppError";

const evolutionService = new EvolutionService();

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

export class EvolutionController {
  async connect(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const result = await evolutionService.createInstance(companyId);
      res.status(201).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async status(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const result = await evolutionService.getConnectionStatus(companyId);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async qrCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const result = await evolutionService.getQrCode(companyId);
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
      const companyId = getCompanyId(req);
      const result = await evolutionService.reconnect(companyId);
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
      const companyId = getCompanyId(req);
      const result = await evolutionService.disconnect(companyId);
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
      const { phone, message } = req.body;
      const result = await evolutionService.sendMessage(
        companyId,
        phone,
        message,
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async getConfig(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const result = await evolutionService.getConfig(companyId);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async saveConfig(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const result = await evolutionService.saveConfig(companyId, req.body);
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
      const { number, type, url, base64, caption, fileName } = req.body;
      if (!number || !type) {
        throw new AppError("number and type are required", 400);
      }
      const result = await evolutionService.sendMedia(companyId, {
        number,
        type,
        url,
        base64,
        caption,
        fileName,
      });
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  async webhook(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const companyId = req.params.companyId as string;
      const result = await evolutionService.handleWebhookEvent(
        companyId,
        req.body,
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
}
