import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  logger.error(`${err.message}`, { stack: err.stack });

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      status: 'validation_error',
      errors: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
    return;
  }

  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
  });
}
