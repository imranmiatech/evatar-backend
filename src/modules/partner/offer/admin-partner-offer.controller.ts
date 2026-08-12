import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
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
import { PartnerOfferService } from './partner-offer.service';

@ApiTags('Admin Partner Offers')
@ApiBearerAuth()
@Controller('admin/partners/offers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminPartnerOfferController {
  constructor(private readonly partnerOfferService: PartnerOfferService) {}

  @Get()
  @ApiOperation({
    summary: 'Get partner offers for admin review',
    description:
      'Use status filters: ALL, ACTIVE, SCHEDULED, PENDING_APPROVAL, EXPIRED, REJECTED, DRAFT, INACTIVE.',
  })
  async getPartnerOffers(@Query() query: PartnerOfferQueryDto) {
    return this.partnerOfferService.getAdminOffers(query);
  }

  @Get(':offerId')
  @ApiOperation({ summary: 'Get one partner offer for admin review' })
  @ApiParam({ name: 'offerId', description: 'Partner offer ID' })
  async getPartnerOffer(@Param('offerId') offerId: string) {
    return this.partnerOfferService.getAdminOffer(offerId);
  }

  @Patch(':offerId/approve')
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

  @Patch(':offerId/reject')
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
}
