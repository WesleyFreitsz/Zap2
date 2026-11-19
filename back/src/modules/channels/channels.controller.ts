import type { Request, RequestHandler } from "express";
import { AppError } from "../../utils/AppError";
import { getWhatsAppTemplates } from "./channel-sender";
import type { ConnectPagesInput, ConnectWhatsAppInput, ManualConnectInput } from "./channels.schema";
import { ChannelsService } from "./channels.service";

function respond<Body>(
  run: (companyId: string, req: Request<Record<string, string>, unknown, Body>) => unknown,
): RequestHandler<Record<string, string>, unknown, Body> {
  return async (req, res, next) => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new AppError("Usuário não está associado a uma empresa", 400);
      res.json({ status: "success", data: await run(companyId, req) });
    } catch (error) {
      next(error);
    }
  };
}

export class ChannelsController {
  constructor(private readonly service: ChannelsService) {}

  findAll = respond((companyId) => this.service.findAll(companyId));
  listWhatsAppTemplates = respond((companyId, req) =>
    getWhatsAppTemplates(companyId, req.params.id, req.query.refresh === "true")
  );
  getMetaConfig = respond(() => this.service.getMetaConfig());
  discoverPages = respond<{ code: string }>((companyId, req) =>
    this.service.discoverPages(companyId, req.body.code)
  );
  connectPages = respond<ConnectPagesInput>((companyId, req) =>
    this.service.connectPages(companyId, req.body)
  );
  connectWhatsApp = respond<ConnectWhatsAppInput>((companyId, req) =>
    this.service.connectWhatsApp(companyId, req.body)
  );
  connectManual = respond<ManualConnectInput>((companyId, req) =>
    this.service.connectManual(companyId, req.body)
  );
  delete = respond((companyId, req) => this.service.delete(companyId, req.params.id));
}
