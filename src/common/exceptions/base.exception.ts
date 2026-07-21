import { HttpException, HttpStatus } from '@nestjs/common';
import { ExceptionCode } from './codes.exception';

export interface IValidationError {
  field: string;
  message: string;
  value?: any;
}

export class BaseException extends HttpException {
  constructor(
    public readonly code: ExceptionCode,
    message: string,
    statusCode: HttpStatus,
    public readonly errors?: IValidationError[],
  ) {
    super({ code, message, errors }, statusCode);
  }
}
