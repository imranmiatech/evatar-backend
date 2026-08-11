import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { AdminPartnerService } from './admin-partner.service';
import { RejectPartnerDto } from './dto/reject-partner.dto';

@ApiTags('Admin Partner')
@ApiBearerAuth()
@Controller('admin/partners')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminPartnerController {
  constructor(private readonly adminPartnerService: AdminPartnerService) {}

  @Get()
  @ApiOperation({ summary: 'Get admin partner list' })
  @ApiResponse({ status: 200, description: 'Return admin partner list.' })
  async getPartners(@Query('status') status?: string) {
    return this.adminPartnerService.getPartners(status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one partner registration request' })
  @ApiParam({ name: 'id', description: 'Partner user ID' })
  async getPartner(@Param('id') id: string) {
    return this.adminPartnerService.getPartner(id);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve partner request and allow login' })
  @ApiParam({ name: 'id', description: 'Partner user ID' })
  async approvePartner(
    @CurrentUser() admin: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.adminPartnerService.approvePartner(id, admin.userId);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject partner request and keep login blocked' })
  @ApiParam({ name: 'id', description: 'Partner user ID' })
  async rejectPartner(
    @CurrentUser() admin: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: RejectPartnerDto,
  ) {
    return this.adminPartnerService.rejectPartner(id, admin.userId, dto);
  }
}
