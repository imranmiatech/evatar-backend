import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import {
  PartnerOfferQueryDto,
  RejectPartnerOfferDto,
} from './dto/partner-offer.dto';
import {
  AdminOfferPartnerQueryDto,
  CreateAdminPartnerOfferDto,
  UpdateAdminPartnerOfferDto,
} from './dto/admin-offer.dto';
import { AdminOfferService } from './admin-offer.service';
import { PartnerOfferService } from './partner-offer.service';

@ApiTags('Admin Partner Offers')
@ApiBearerAuth()
@Controller('admin/partners')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminPartnerOfferController {
  constructor(
    private readonly partnerOfferService: PartnerOfferService,
    private readonly adminOfferService: AdminOfferService,
  ) {}

  @Get('offers')
  @ApiOperation({
    summary: 'Get partner offers for admin review',
    description:
      'Use status filters: ALL, ACTIVE, SCHEDULED, PENDING_APPROVAL, EXPIRED, REJECTED, DRAFT, INACTIVE.',
  })
  async getPartnerOffers(@Query() query: PartnerOfferQueryDto) {
    return this.partnerOfferService.getAdminOffers(query);
  }

  @Get('offers/:offerId')
  @ApiOperation({ summary: 'Get one partner offer for admin review' })
  @ApiParam({ name: 'offerId', description: 'Partner offer ID' })
  async getPartnerOffer(@Param('offerId') offerId: string) {
    return this.partnerOfferService.getAdminOffer(offerId);
  }

  @Patch('offers/:offerId/approve')
  @ApiOperation({
    summary: 'Approve a partner offer and publish it',
    description:
      'Sets status to ACTIVE. Scheduled offers remain hidden until startDate.',
  })
  @ApiParam({ name: 'offerId', description: 'Partner offer ID' })
  async approvePartnerOffer(
    @CurrentUser() admin: CurrentUserPayload,
    @Param('offerId') offerId: string,
  ) {
    return this.partnerOfferService.approveOffer(admin, offerId);
  }

  @Patch('offers/:offerId/reject')
  @ApiOperation({ summary: 'Reject a partner offer' })
  @ApiParam({ name: 'offerId', description: 'Partner offer ID' })
  @ApiBody({ type: RejectPartnerOfferDto })
  async rejectPartnerOffer(
    @CurrentUser() admin: CurrentUserPayload,
    @Param('offerId') offerId: string,
    @Body() dto: RejectPartnerOfferDto,
  ) {
    return this.partnerOfferService.rejectOffer(admin, offerId, dto);
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

  @Patch('admin-offers/:offerId')
  @ApiTags('Admin Partner Offer')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({
    summary: 'Admin updates an offer for a selected partner',
    description:
      'Partially updates a PartnerOffer. Send locations as JSON array to replace offer locations.',
  })
  @ApiParam({ name: 'offerId', description: 'Partner offer ID' })
  @ApiBody({ type: UpdateAdminPartnerOfferDto })
  updateAdminOffer(
    @CurrentUser() admin: CurrentUserPayload,
    @Param('offerId') offerId: string,
    @Body() dto: UpdateAdminPartnerOfferDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.adminOfferService.updateOffer(admin, offerId, dto, image);
  }
}
