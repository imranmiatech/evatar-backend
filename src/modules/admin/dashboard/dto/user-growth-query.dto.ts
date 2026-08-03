import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';

export enum UserGrowthPeriod {
  D7 = '7D',
  D30 = '30D',
  D90 = '90D',
  M12 = '12M',
}

export class UserGrowthQueryDto {
  @ApiPropertyOptional({
    enum: UserGrowthPeriod,
    default: UserGrowthPeriod.D30,
    description: 'Time period filter for user growth analytics (7D, 30D, 90D, 12M)',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(UserGrowthPeriod, {
    message: 'period must be one of: 7D, 30D, 90D, 12M',
  })
  period?: UserGrowthPeriod = UserGrowthPeriod.D30;

  @ApiPropertyOptional({
    enum: UserRole,
    description: 'Optional user role filter (PARENT, NANNY, PARTNER, ADMIN)',
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export interface UserGrowthChartPoint {
  label: string;
  date: string;
  newUsers: number;
  totalUsers: number;
}
