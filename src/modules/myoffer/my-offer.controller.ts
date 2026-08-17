import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MyOfferQueryDto, RedeemInStoreDto } from './dto/my-offer-query.dto';
import { MyOfferService } from './my-offer.service';

@ApiTags('My Offers (Alurei Rewards)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('my-offers')
export class MyOfferController {
  constructor(private readonly myOfferService: MyOfferService) {}

  @Get()
  @ApiOperation({
    summary: 'Get active approved partner offers list (Alurei Rewards)',
    description:
      'Returns a list of approved partner offers active between start date and end date. Supports filtering by tab (ALL, SAVED) and search keyword.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active partner offers list returned successfully.',
  })
  getMyOffers(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: MyOfferQueryDto,
  ) {
    return this.myOfferService.getMyOffers(user.userId, query);
  }

  @Get('redemptions/me')
  @ApiOperation({
    summary: 'Get user\'s redeemed rewards history',
    description:
      'Returns list of offers redeemed by the logged-in user for "Visit my rewards" screen.',
  })
  @ApiResponse({
    status: 200,
    description: 'Redeemed rewards returned successfully.',
  })
  getMyRedeemedRewards(@CurrentUser() user: CurrentUserPayload) {
    return this.myOfferService.getMyRedeemedRewards(user.userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get detailed partner offer view',
    description:
      'Returns complete offer details including What\'s Included, Terms & Conditions, Available Locations, and user redemption eligibility.',
  })
  @ApiParam({ name: 'id', description: 'Partner offer UUID' })
  @ApiResponse({
    status: 200,
    description: 'Offer details returned successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Offer not found or no longer active.',
  })
  getMyOfferDetails(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') offerId: string,
  ) {
    return this.myOfferService.getMyOfferDetails(user.userId, offerId);
  }

  @Post(':id/toggle-save')
  @ApiOperation({
    summary: 'Bookmark / Save or Unsave an offer',
    description:
      'Toggles bookmark state of an offer for the logged-in user.',
  })
  @ApiParam({ name: 'id', description: 'Partner offer UUID' })
  @ApiResponse({
    status: 200,
    description: 'Bookmark status toggled successfully.',
  })
  toggleSaveOffer(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') offerId: string,
  ) {
    return this.myOfferService.toggleSaveOffer(user.userId, offerId);
  }

  @Post(':id/redeem')
  @ApiOperation({
    summary: 'Redeem partner offer with ALR points',
    description:
      'Redeems the offer using user\'s ALR points balance and returns Redemption Success data.',
  })
  @ApiParam({ name: 'id', description: 'Partner offer UUID' })
  @ApiResponse({
    status: 200,
    description: 'Offer redeemed successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Insufficient points or offer invalid.',
  })
  redeemOffer(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') offerId: string,
    @Body() dto?: RedeemInStoreDto,
  ) {
    return this.myOfferService.redeemInStoreOffer(user.userId, offerId, dto);
  }

  @Post(':id/redeem-instore')
  @ApiOperation({
    summary: 'In-Store QR Code Scan & Redemption Flow',
    description:
      'Processes QR code scan at store counter, deducts ALR points, and returns Redemption Success screen data.',
  })
  @ApiParam({ name: 'id', description: 'Partner offer UUID' })
  @ApiResponse({
    status: 200,
    description: 'In-Store QR redemption verified and processed successfully.',
  })
  redeemInStoreOffer(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') offerId: string,
    @Body() dto: RedeemInStoreDto,
  ) {
    return this.myOfferService.redeemInStoreOffer(user.userId, offerId, dto);
  }
}
