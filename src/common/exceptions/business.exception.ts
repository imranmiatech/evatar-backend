import { HttpStatus } from '@nestjs/common';
import { BaseException, IValidationError } from './base.exception';
import { ExceptionCode } from './codes.exception';

export class NotFoundException extends BaseException {
  constructor(resource: string) {
    super(
      ExceptionCode.NOT_FOUND,
      `${resource} not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class AlreadyExistsException extends BaseException {
  constructor(resource: string) {
    super(
      ExceptionCode.ALREADY_EXISTS,
      `${resource} already exists`,
      HttpStatus.CONFLICT,
    );
  }
}

export class InvalidCredentialsException extends BaseException {
  constructor() {
    super(
      ExceptionCode.INVALID_CREDENTIALS,
      'Invalid email or password',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class UnauthorizedException extends BaseException {
  constructor(message = 'Unauthorized') {
    super(ExceptionCode.UNAUTHORIZED, message, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenException extends BaseException {
  constructor(message = 'Access denied') {
    super(ExceptionCode.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }
}

export class TokenExpiredException extends BaseException {
  constructor() {
    super(
      ExceptionCode.TOKEN_EXPIRED,
      'Token has expired',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class TokenInvalidException extends BaseException {
  constructor() {
    super(
      ExceptionCode.TOKEN_INVALID,
      'Token is invalid',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class EmailNotVerifiedException extends BaseException {
  constructor() {
    super(
      ExceptionCode.EMAIL_NOT_VERIFIED,
      'Email is not verified',
      HttpStatus.FORBIDDEN,
    );
  }
}

export class AccountSuspendedException extends BaseException {
  constructor() {
    super(
      ExceptionCode.ACCOUNT_SUSPENDED,
      'Account has been suspended',
      HttpStatus.FORBIDDEN,
    );
  }
}

export class AccountBannedException extends BaseException {
  constructor() {
    super(
      ExceptionCode.ACCOUNT_BANNED,
      'Account has been banned',
      HttpStatus.FORBIDDEN,
    );
  }
}

export class OtpExpiredException extends BaseException {
  constructor() {
    super(ExceptionCode.OTP_EXPIRED, 'OTP has expired', HttpStatus.BAD_REQUEST);
  }
}

export class OtpInvalidException extends BaseException {
  constructor() {
    super(ExceptionCode.OTP_INVALID, 'OTP is invalid', HttpStatus.BAD_REQUEST);
  }
}

export class OtpAlreadyUsedException extends BaseException {
  constructor() {
    super(
      ExceptionCode.OTP_ALREADY_USED,
      'OTP has already been used',
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class TooManyAttemptsException extends BaseException {
  constructor(minutesLeft?: number) {
    super(
      ExceptionCode.TOO_MANY_ATTEMPTS,
      minutesLeft
        ? `Too many attempts. Try again in ${minutesLeft} minutes`
        : 'Too many attempts. Please try again later',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class ConflictException extends BaseException {
  constructor(message: string) {
    super(ExceptionCode.CONFLICT, message, HttpStatus.CONFLICT);
  }
}

export class ValidationException extends BaseException {
  constructor(errors: IValidationError[]) {
    super(
      ExceptionCode.VALIDATION_ERROR,
      'Validation failed',
      HttpStatus.BAD_REQUEST,
      errors,
    );
  }
}

export class ServiceUnavailableException extends BaseException {
  constructor(message = 'Service is temporarily unavailable') {
    super(
      ExceptionCode.SERVICE_UNAVAILABLE,
      message,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
