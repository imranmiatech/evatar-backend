import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class RecentActivityQueryDto {
  @ApiPropertyOptional({
    default: 10,
    description: 'Number of recent activities to fetch (default: 10, max: 50)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

export interface RecentActivityItem {
  id: string;
  type: string;
  color: 'green' | 'purple' | 'blue' | 'orange' | 'red' | 'yellow';
  title: string;
  subtitle: string;
  timestamp: string;
  timeAgo: string;
}
