import { Request, Response, NextFunction } from 'express';
import { AiConfigService } from './aiConfig.service';

const aiConfigService = new AiConfigService();

export class AiConfigController {
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user!.companyId!;
      const result = await aiConfigService.get(companyId);
      res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user!.companyId!;
      const result = await aiConfigService.update(companyId, req.body);
      res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }
}
