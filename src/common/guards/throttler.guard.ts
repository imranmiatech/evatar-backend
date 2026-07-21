import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: any,
  ): Promise<void> {
    const ttl = throttlerLimitDetail?.timeToExpire;
    const minutesLeft = ttl ? Math.ceil(ttl / 60) : undefined;
    throw new ThrottlerException(`Too many attempts. Try again later.`);
  }

  protected getTracker(req: Record<string, any>): Promise<string> {
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ??
      req.headers['x-real-ip'] ??
      req.ip ??
      req.connection?.remoteAddress ??
      'unknown';
    return Promise.resolve(ip);
  }
}
