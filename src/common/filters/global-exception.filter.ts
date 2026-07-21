import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ThrottlerException } from '@nestjs/throttler';
import { BaseException } from '../exceptions/base.exception';
import { ExceptionCode } from '../exceptions/codes.exception';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.buildErrorResponse(exception, request);

    if (errorResponse.statusCode >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url}`,
        exception instanceof Error ? exception.stack : exception,
      );
    } else {
      this.logger.warn(
        `[${request.method}] ${request.url} - ${errorResponse.statusCode} ${errorResponse.error}`,
      );
    }

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private buildErrorResponse(exception: unknown, request: Request) {
    const timestamp = new Date().toISOString();
    const path = request.url;
    const isDev = process.env.NODE_ENV === 'development';

    if (exception instanceof BaseException) {
      const body = exception.getResponse() as any;
      return {
        success: false,
        statusCode: exception.getStatus(),
        message: body.message,
        error: body.code,
        ...(body.errors?.length && { errors: body.errors }),
        timestamp,
        path,
      };
    }

    if (exception instanceof ThrottlerException) {
      return {
        success: false,
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many requests. Please try again later',
        error: ExceptionCode.TOO_MANY_ATTEMPTS,
        timestamp,
        path,
      };
    }

    if (exception instanceof HttpException) {
      const body = exception.getResponse() as any;

      if (body.errors?.length) {
        return {
          success: false,
          statusCode: exception.getStatus(),
          message: body.message ?? 'Validation failed',
          error: ExceptionCode.VALIDATION_ERROR,
          errors: body.errors,
          timestamp,
          path,
        };
      }

      return {
        success: false,
        statusCode: exception.getStatus(),
        message: body.message ?? 'An error occurred',
        error: body.error ?? 'HTTP_ERROR',
        timestamp,
        path,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaError(exception, timestamp, path);
    }

    return {
      success: false,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: ExceptionCode.INTERNAL_ERROR,
      timestamp,
      path,
      ...(isDev && { stack: (exception as Error)?.stack }),
    };
  }

  private handlePrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
    timestamp: string,
    path: string,
  ) {
    const prismaErrorMap: Record<
      string,
      { statusCode: number; message: string; error: string }
    > = {
      P2002: {
        statusCode: HttpStatus.CONFLICT,
        message: 'Resource already exists',
        error: ExceptionCode.ALREADY_EXISTS,
      },
      P2025: {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Resource not found',
        error: ExceptionCode.NOT_FOUND,
      },
      P2003: {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid relation provided',
        error: ExceptionCode.INVALID_INPUT,
      },
      P2016: {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Record not found',
        error: ExceptionCode.NOT_FOUND,
      },
      P2014: {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Relation violation',
        error: ExceptionCode.INVALID_INPUT,
      },
    };

    const mapped = prismaErrorMap[exception.code] ?? {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Database error occurred',
      error: ExceptionCode.DATABASE_ERROR,
    };

    return { success: false, ...mapped, timestamp, path };
  }
}
