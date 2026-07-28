import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { RequestWithId } from './request-id.middleware';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: RequestWithId, res: Response, next: NextFunction) {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      this.logger.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms reqId=${req.requestId}`);
    });
    next();
  }
}
