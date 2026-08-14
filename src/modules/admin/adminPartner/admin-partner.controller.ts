import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { AdminPartnerService } from './admin-partner.service';
import { RejectPartnerDto } from './dto/reject-partner.dto';
import { UpdatePartnerRequestStatusDto } from './dto/update-partner-request-status.dto';

@ApiTags('Admin Partner')
@ApiBearerAuth()
@Controller('admin/partners')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminPartnerController {
  constructor(private readonly adminPartnerService: AdminPartnerService) {}

  @Get()
  @ApiOperation({
    summary: 'Get admin partner registration requests',
    description:
      'Use this list for partner request dashboard. Filter by NEW, CONTACTED, IN_DISCUSSION, DECLINED, PENDING, APPROVED, REJECTED, ACTIVE, or INACTIVE.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [
      'ALL',
      'NEW',
      'CONTACTED',
      'IN_DISCUSSION',
      'DECLINED',
      'PENDING',
      'APPROVED',
      'REJECTED',
      'ACTIVE',
      'INACTIVE',
    ],
    example: 'NEW',
  })
  @ApiResponse({
    status: 200,
    description: 'Return admin partner request list.',
  })
  async getPartners(@Query('status') status?: string) {
    return this.adminPartnerService.getPartners(status);
  }

  @Get('new-requests')
  @ApiOperation({
    summary: 'Get partnership requests for admin dashboard',
    description:
      'Returns partner signup requests stored from partner signup. Filter by adminStatus values: NEW, CONTACTED, IN_DISCUSSION, DECLINED.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['ALL', 'NEW', 'CONTACTED', 'IN_DISCUSSION', 'DECLINED'],
    example: 'NEW',
  })
  async getPartnerNewRequests(@Query('status') status?: string) {
    return this.adminPartnerService.getPartners(status);
  }

  @Get('overview')
  @ApiTags('Admin Partner Overview')
  @ApiOperation({
    summary: 'Get admin partner dashboard cards',
    description:
      'Returns only Total Partners and Active Offers with monthly plus/minus growth and sparkline data.',
  })
  @ApiResponse({
    status: 200,
    description: 'Return admin partner dashboard cards.',
  })
  async getOverview() {
    return this.adminPartnerService.getOverview();
  }

  @Get('overview/cards')
  @ApiTags('Admin Partner Overview')
  @ApiOperation({
    summary: 'Get admin partner dashboard cards',
    description:
      'Returns Total Partners and Active Offers with monthly plus/minus growth fields.',
  })
  @ApiResponse({
    status: 200,
    description: 'Return admin partner dashboard cards.',
  })
  async getOverviewCards() {
    return this.adminPartnerService.getOverviewCards();
  }

  @Get('overview/categories')
  @ApiTags('Admin Partner Overview')
  @ApiOperation({
    summary: 'Get admin partners by category',
    description:
      'Returns partner category counts and percentages for the category chart.',
  })
  @ApiResponse({
    status: 200,
    description: 'Return partner category distribution.',
  })
  async getPartnersByCategory() {
    return this.adminPartnerService.getPartnersByCategory();
  }

  @Get('overview/attention')
  @ApiTags('Admin Partner Overview')
  @ApiOperation({
    summary: 'Get admin partner attention required items',
    description:
      'Returns pending partner requests, pending offer approvals, and active offers expiring within 7 days.',
  })
  @ApiResponse({
    status: 200,
    description: 'Return partner attention required items.',
  })
  async getAttentionRequired() {
    return this.adminPartnerService.getAttentionRequired();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one partner registration request',
    description:
      'Returns business details, contact details, review status, rejection reason, and created store data.',
  })
  @ApiParam({ name: 'id', description: 'Partner user ID' })
  async getPartner(@Param('id') id: string) {
    return this.adminPartnerService.getPartner(id);
  }

  @Patch(':id/request-status')
  @ApiOperation({
    summary: 'Update partner request dashboard status',
    description:
      'Updates adminStatus for partnership request cards: NEW, CONTACTED, IN_DISCUSSION, or DECLINED.',
  })
  @ApiParam({ name: 'id', description: 'Partner user ID' })
  @ApiBody({ type: UpdatePartnerRequestStatusDto })
  async updatePartnerRequestStatus(
    @CurrentUser() admin: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePartnerRequestStatusDto,
  ) {
    return this.adminPartnerService.updatePartnerRequestStatus(
      id,
      admin.userId,
      dto,
    );
  }

  @Patch(':id/approve')
  @ApiOperation({
    summary: 'Approve partner request and allow login',
    description:
      'Sets partner user status to ACTIVE, verificationStatus to APPROVED, records reviewer info, and sends approval email.',
  })
  @ApiParam({ name: 'id', description: 'Partner user ID' })
  async approvePartner(
    @CurrentUser() admin: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.adminPartnerService.approvePartner(id, admin.userId);
  }

  @Patch(':id/reject')
  @ApiOperation({
    summary: 'Reject partner request and keep login blocked',
    description:
      'Sets partner user status to INACTIVE, verificationStatus to REJECTED, stores rejection reason, and sends rejection email.',
  })
  @ApiParam({ name: 'id', description: 'Partner user ID' })
  @ApiBody({ type: RejectPartnerDto })
  async rejectPartner(
    @CurrentUser() admin: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: RejectPartnerDto,
  ) {
    return this.adminPartnerService.rejectPartner(id, admin.userId, dto);
  }
}
