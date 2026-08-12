import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PartnerDashboardRangeQueryDto } from './dto/partner-dashboard-query.dto';
import { PartnerDashboardService } from './partner-dashboard.service';

@ApiTags('Partner Dashboard')
@ApiBearerAuth()
@Controller('partner/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PartnerDashboardController {
  constructor(
    private readonly partnerDashboardService: PartnerDashboardService,
  ) {}

  @Get()
  @Roles(UserRole.PARTNER)
  @ApiOperation({ summary: 'Get full partner dashboard overview' })
  getDashboard(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PartnerDashboardRangeQueryDto,
  ) {
    return this.partnerDashboardService.getDashboard(user, query);
  }
}
