import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter Prisma mapping', () => {
  it('maps a database uniqueness race to HTTP 409 instead of leaking a 500', () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({ url: '/products' }),
      }),
    } as unknown as ArgumentsHost;
    const error = new Prisma.PrismaClientKnownRequestError('unique constraint', {
      code: 'P2002',
      clientVersion: 'test',
    });

    new HttpExceptionFilter().catch(error, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.CONFLICT,
        message: 'A record with the same unique value already exists.',
        path: '/products',
      }),
    );
  });
});
