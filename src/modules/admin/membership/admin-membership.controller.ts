import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { AdminMembershipService } from './admin-membership.service';

@ApiTags('Admin Membership')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/membership')
export class AdminMembershipController {
  constructor(
    private readonly adminMembershipService: AdminMembershipService,
  ) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get admin membership dashboard payload',
    description:
      'Returns overview cards and distribution chart data for the admin Membership page.',
  })
  @ApiResponse({
    status: 200,
    description: 'Admin membership dashboard payload returned successfully.',
  })
  getDashboard() {
    return this.adminMembershipService.getDashboard();
  }

  @Get('distribution')
  @ApiOperation({
    summary: 'Get admin membership distribution chart data',
    description:
      'Returns Free, Monthly, Yearly, and Global family distribution with monthly-equivalent revenue.',
  })
  @ApiResponse({
    status: 200,
    description: 'Admin membership distribution returned successfully.',
  })
  getDistribution() {
    return this.adminMembershipService.getDistribution();
  }
}
