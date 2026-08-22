import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      passReqToCallback: true,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') as string,
    });
  }

  async validate(req: any, payload: any) {
    if (!payload?.sub || !payload?.role) {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        status: true,
        verificationStatus: true,
        preferredLanguage: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException();
    }

    const requestPath = req?.originalUrl || req?.url || '';
    const isPreKycOnboardingRequest =
      requestPath.startsWith('/api/v1/kyc/') ||
      requestPath === '/api/v1/auth/me' ||
      requestPath === '/api/v1/membership/claim-trial' ||
      requestPath === '/api/v1/payment/checkout' ||
      requestPath.startsWith('/api/v1/membership/plans') ||
      requestPath === '/api/v1/membership/me';
    const isPendingKycUser =
      (user.role === UserRole.PARENT || user.role === UserRole.NANNY) &&
      user.status === UserStatus.PENDING;

    if (isPendingKycUser && !isPreKycOnboardingRequest) {
      throw new UnauthorizedException(
        'Complete Sumsub identity verification before using this account.',
      );
    }

    return {
      id: user.id,
      userId: user.id,
      role: user.role,
      status: user.status,
      verificationStatus: user.verificationStatus,
      preferredLanguage: user.preferredLanguage,
    };
  }
}
