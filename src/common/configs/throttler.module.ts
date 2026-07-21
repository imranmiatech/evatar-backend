import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { RATE_LIMIT } from '../constants/rate-limit.constant';
import { CustomThrottlerGuard } from '../guards/throttler.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: RATE_LIMIT.GLOBAL.ttl,
          limit: RATE_LIMIT.GLOBAL.limit,
        },
      ],
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class ThrottlerConfigModule {}
