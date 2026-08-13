import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
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
import { AdminOfferService } from './admin-offer/admin-offer.service';
import {
  AdminOfferPartnerQueryDto,
  CreateAdminPartnerOfferDto,
} from './admin-offer/dto/admin-offer.dto';
import { AdminPartnerService } from './admin-partner.service';
import { RejectPartnerDto } from './dto/reject-partner.dto';

@ApiTags('Admin Partner')
@ApiBearerAuth()
@Controller('admin/partners')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminPartnerController {
  constructor(
    private readonly adminPartnerService: AdminPartnerService,
    private readonly adminOfferService: AdminOfferService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get admin partner registration requests',
    description:
      'Use this list for partner approval dashboard. Filter by PENDING, APPROVED, REJECTED, ACTIVE, or INACTIVE.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE'],
    example: 'PENDING',
  })
  @ApiResponse({
    status: 200,
    description: 'Return admin partner request list.',
  })
  async getPartners(@Query('status') status?: string) {
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

  @Get('admin-offers/partners')
  @ApiTags('Admin Partner Offer')
  @ApiOperation({
    summary: 'Browse partners for admin offer create form',
    description:
      'Use this for the Partner select option. Admin can type/search and select one partnerUserId.',
  })
  getAdminOfferPartnerOptions(@Query() query: AdminOfferPartnerQueryDto) {
    return this.adminOfferService.getPartnerOptions(query);
  }

  @Get('admin-offers/partners/:partnerUserId/locations')
  @ApiTags('Admin Partner Offer')
  @ApiOperation({
    summary: 'Get selected partner locations for admin offer create form',
  })
  @ApiParam({ name: 'partnerUserId', description: 'Partner user ID' })
  getAdminOfferPartnerLocations(
    @Param('partnerUserId') partnerUserId: string,
  ) {
    return this.adminOfferService.getPartnerLocations(partnerUserId);
  }

  @Post('admin-offers')
  @ApiTags('Admin Partner Offer')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({
    summary: 'Admin creates an offer for a selected partner',
    description:
      'Creates a PartnerOffer for partnerUserId. ACTIVE offers are published immediately by admin.',
  })
  @ApiBody({ type: CreateAdminPartnerOfferDto })
  createAdminOffer(
    @CurrentUser() admin: CurrentUserPayload,
    @Body() dto: CreateAdminPartnerOfferDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.adminOfferService.createOffer(admin, dto, image);
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
