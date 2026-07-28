import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const isPrisma = exception instanceof Prisma.PrismaClientKnownRequestError;
    const prismaCode = isPrisma ? exception.code : undefined;
    const prismaStatus =
      prismaCode === 'P2002'
        ? HttpStatus.CONFLICT
        : prismaCode === 'P2003'
          ? HttpStatus.CONFLICT
          : prismaCode === 'P2025'
            ? HttpStatus.NOT_FOUND
            : undefined;
    const status = isHttp ? exception.getStatus() : prismaStatus ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttp
      ? exception.getResponse()
      : prismaStatus
        ? {
            message:
              prismaCode === 'P2002'
                ? 'A record with the same unique value already exists.'
                : prismaCode === 'P2003'
                  ? 'This operation conflicts with a referenced record.'
                  : 'The requested record no longer exists.',
          }
        : null;
    const referenceId = randomUUID().slice(0, 8);
    const isHandled = isHttp || prismaStatus !== undefined;

    if (!isHandled) {
      this.logger.error(`Unhandled exception ref=${referenceId} path=${request.url}`, (exception as Error)?.stack);
    }

    // Exceptions thrown with a structured payload — e.g.
    // `new BadRequestException({ message: 'Publish blocked', blockers: [...] })`
    // — previously had every field except `message` silently discarded here,
    // so a client could never render the blocker list it needed. Any plain
    // object body is now spread through; only string/array bodies fall back
    // to a bare `message`.
    const structuredBody =
      isHandled && typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>)
        : undefined;

    response.status(status).json({
      ...structuredBody,
      statusCode: status,
      message: structuredBody
        ? structuredBody.message
        : isHandled
          ? (body as unknown as string)
          : 'Something went wrong on our side.',
      referenceId: isHandled ? undefined : referenceId,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
