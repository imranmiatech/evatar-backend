import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { RATE_LIMIT } from '../constants/rate-limit.constant';

export const ThrottleRegister = () =>
  Throttle({
    default: {
      ttl: RATE_LIMIT.REGISTER.ttl,
      limit: RATE_LIMIT.REGISTER.limit,
    },
  });

export const ThrottleRefreshToken = () =>
  Throttle({
    default: {
      ttl: RATE_LIMIT.REFRESH_TOKEN.ttl,
      limit: RATE_LIMIT.REFRESH_TOKEN.limit,
    },
  });

export const ThrottleLogin = () =>
  Throttle({
    default: {
      ttl: RATE_LIMIT.LOGIN.ttl,
      limit: RATE_LIMIT.LOGIN.limit,
    },
  });

export const ThrottleOtp = () =>
  Throttle({
    default: {
      ttl: RATE_LIMIT.OTP.ttl,
      limit: RATE_LIMIT.OTP.limit,
    },
  });

export const ThrottleOtpResend = () =>
  Throttle({
    default: {
      ttl: RATE_LIMIT.OTP_RESEND.ttl,
      limit: RATE_LIMIT.OTP_RESEND.limit,
    },
  });

export const ThrottlePasswordReset = () =>
  Throttle({
    default: {
      ttl: RATE_LIMIT.PASSWORD_RESET.ttl,
      limit: RATE_LIMIT.PASSWORD_RESET.limit,
    },
  });

export const ThrottleProfileUpdate = () =>
  Throttle({
    default: {
      ttl: RATE_LIMIT.PROFILE_UPDATE.ttl,
      limit: RATE_LIMIT.PROFILE_UPDATE.limit,
    },
  });

export const ThrottleAccountDelete = () =>
  Throttle({
    default: {
      ttl: RATE_LIMIT.ACCOUNT_DELETE.ttl,
      limit: RATE_LIMIT.ACCOUNT_DELETE.limit,
    },
  });

export const NoThrottle = () => SkipThrottle();
