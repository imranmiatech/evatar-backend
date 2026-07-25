import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Request } from 'express';
import { from, Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  SupportedLanguageCode,
} from '../../modules/language/language.constants';
import { LanguageService } from '../../modules/language/language.service';

export interface IPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface IApiResponse<T = any> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  meta?: IPaginationMeta;
  timestamp: string;
  path: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  IApiResponse<T>
> {
  constructor(
    private readonly reflector: Reflector,
    private readonly languageService: LanguageService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<IApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();

    const httpCode = this.reflector.get<number>(
      HTTP_CODE_METADATA,
      context.getHandler(),
    );

    return next.handle().pipe(
      mergeMap((data: any) =>
        from(
          (async () => {
        const statusCode = data?.statusCode ?? httpCode ?? 200;
        const language = this.responseLanguage(request);
        const responseData = data?.data !== undefined ? data.data : data;

        return {
          success: true,
          statusCode,
              message: await this.languageService.translateAsync(
                data?.message ?? 'Success',
                language,
              ),
              data: await this.languageService.translateAsync(
                responseData,
                language,
              ),
              ...(data?.meta && {
                meta: await this.languageService.translateAsync(
                  data.meta,
                  language,
                ),
              }),
          timestamp: new Date().toISOString(),
          path: request.url,
        };
          })(),
        ),
      ),
    );
  }

  private responseLanguage(request: Request): SupportedLanguageCode {
    const user = request.user as { preferredLanguage?: unknown } | undefined;
    const headerLanguage =
      this.headerValue(request.headers['x-language']) ??
      this.headerValue(request.headers['accept-language'])?.split(',')[0];
    const language =
      headerLanguage ??
      (typeof user?.preferredLanguage === 'string'
        ? user.preferredLanguage
        : undefined);
    const normalized = language?.trim().toLowerCase();
    const found = SUPPORTED_LANGUAGES.find((item) => item.code === normalized);

    return found?.code ?? DEFAULT_LANGUAGE;
  }

  private headerValue(value: unknown) {
    if (Array.isArray(value)) {
      return value[0];
    }

    return typeof value === 'string' ? value : undefined;
  }

}
