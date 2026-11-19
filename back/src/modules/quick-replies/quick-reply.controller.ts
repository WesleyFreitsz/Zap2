import { Request, RequestHandler } from "express";
import { AppError } from "../../utils/AppError";
import { QuickReplyInput } from "./quick-reply.schema";
import { QuickReplyService } from "./quick-reply.service";

const service = new QuickReplyService();

function getCompanyId(req: Request): string {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError("Usuário sem empresa", 403);
  return companyId;
}

export const findAll: RequestHandler = async (req, res, next) => {
  try {
    const data = await service.findAll(getCompanyId(req));
    res.json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};

export const create: RequestHandler<{}, unknown, QuickReplyInput> = async (req, res, next) => {
  try {
    const data = await service.create(getCompanyId(req), req.body);
    res.status(201).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};

export const update: RequestHandler<{ id: string }, unknown, QuickReplyInput> = async (req, res, next) => {
  try {
    const data = await service.update(getCompanyId(req), req.params.id, req.body);
    res.json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};

export const remove: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    await service.delete(getCompanyId(req), req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
