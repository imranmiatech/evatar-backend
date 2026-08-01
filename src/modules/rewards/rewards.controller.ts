import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateRewardOfferDto } from './dto/create-reward-offer.dto';
import {
  CreatePartnerStoreDto,
  UpdatePartnerStoreDto,
} from './dto/partner-store.dto';
import {
  RewardLedgerQueryDto,
  RewardOfferQueryDto,
} from './dto/reward-query.dto';
import { RedeemRewardOfferDto } from './dto/redeem-reward-offer.dto';
import { UpdateRewardOfferDto } from './dto/update-reward-offer.dto';
import { UseRedemptionDto } from './dto/use-redemption.dto';
import { RewardsService } from './rewards.service';

@ApiTags('Rewards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get('me')
  @Roles(UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Get my reward balance and points rules' })
  getMySummary(@CurrentUser() user: CurrentUserPayload) {
    return this.rewardsService.getMySummary(user);
  }

  @Get('ledger')
  @Roles(UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Get my reward earn/spend ledger' })
  getMyLedger(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: RewardLedgerQueryDto,
  ) {
    return this.rewardsService.getMyLedger(user, query);
  }

  @Get('offers')
  @Roles(UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Get active reward offers from partners' })
  getOffers(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: RewardOfferQueryDto,
  ) {
    return this.rewardsService.getOffers(user, query);
  }

  @Get('offers/saved')
  @Roles(UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Get my saved reward offers' })
  getSavedOffers(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: RewardOfferQueryDto,
  ) {
    return this.rewardsService.getSavedOffers(user, query);
  }

  @Get('offers/:offerId')
  @Roles(UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Get reward offer details' })
  @ApiParam({ name: 'offerId' })
  getOfferDetail(
    @CurrentUser() user: CurrentUserPayload,
    @Param('offerId') offerId: string,
  ) {
    return this.rewardsService.getOfferDetail(user, offerId);
  }

  @Post('offers/:offerId/redeem')
  @Roles(UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({
    summary: 'Redeem a partner product offer using the exact point cost',
    description: 'Redemption expires 180 days after claim.',
  })
  @ApiParam({ name: 'offerId' })
  redeemOffer(
    @CurrentUser() user: CurrentUserPayload,
    @Param('offerId') offerId: string,
    @Body() dto: RedeemRewardOfferDto,
  ) {
    return this.rewardsService.redeemOffer(user, offerId, dto);
  }

  @Post('offers/:offerId/save')
  @Roles(UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Save a reward offer' })
  @ApiParam({ name: 'offerId' })
  saveOffer(
    @CurrentUser() user: CurrentUserPayload,
    @Param('offerId') offerId: string,
  ) {
    return this.rewardsService.saveOffer(user, offerId);
  }

  @Post('offers/:offerId/unsave')
  @Roles(UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Remove a reward offer from saved list' })
  @ApiParam({ name: 'offerId' })
  unsaveOffer(
    @CurrentUser() user: CurrentUserPayload,
    @Param('offerId') offerId: string,
  ) {
    return this.rewardsService.unsaveOffer(user, offerId);
  }

  @Get('redemptions')
  @Roles(UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Get my redeemed reward offers' })
  getMyRedemptions(@CurrentUser() user: CurrentUserPayload) {
    return this.rewardsService.getMyRedemptions(user);
  }

  @Post('tasks/:dayActivityId/complete')
  @Roles(UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({
    summary: 'Mark a Today task complete and award 2 points once',
  })
  @ApiParam({ name: 'dayActivityId' })
  completeTaskForReward(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dayActivityId') dayActivityId: string,
  ) {
    return this.rewardsService.completeTaskForReward(user, dayActivityId);
  }
}

@ApiTags('Partner Rewards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARTNER)
@Controller('partner/rewards')
export class PartnerRewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Post('offers')
  @ApiOperation({ summary: 'Create a product offer redeemable by points' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'productName', 'pointsCost'],
      properties: {
        storeId: { type: 'string', format: 'uuid' },
        storeIds: {
          type: 'string',
          description:
            'JSON array string or comma-separated branch/store IDs where this offer is available.',
          example: '["store-id-1","store-id-2"]',
        },
        title: {
          type: 'string',
          example: '20% off Serenity Spa baby care pack',
        },
        productName: { type: 'string', example: 'Serenity Spa baby care pack' },
        description: {
          type: 'string',
          example: 'Holistic wellness essentials for families.',
        },
        includedTitle: { type: 'string', example: "What's included" },
        includedDescription: {
          type: 'string',
          example:
            'Get 25% discount with 300 Alurei. Applied directly at checkout or shown in-store.',
        },
        terms: {
          type: 'string',
          example: 'Valid once per user. Cannot be combined with other offers.',
        },
        imageUrl: {
          type: 'string',
          example: 'https://example.com/product.png',
          description:
            'Optional fallback URL. If image file is provided, it will be uploaded and used instead.',
        },
        image: {
          type: 'string',
          format: 'binary',
          description: 'Offer image file uploaded as multipart form-data.',
        },
        channel: {
          type: 'string',
          enum: ['ONLINE', 'IN_STORE', 'BOTH'],
          example: 'BOTH',
        },
        onlineCouponCode: { type: 'string', example: 'ALUREI15' },
        websiteUrl: {
          type: 'string',
          example: 'https://partner.example.com/alurei-offer',
        },
        pointsCost: { type: 'integer', example: 50 },
        availableQuantity: { type: 'integer', example: 100 },
        startsAt: { type: 'string', format: 'date-time' },
        endsAt: { type: 'string', format: 'date-time' },
        locations: {
          type: 'string',
          description:
            'JSON array string. Example: [{"name":"Dubai Mall","address":"Downtown Dubai, Level LG","city":"Dubai"}]',
        },
      },
    },
  })
  createOffer(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateRewardOfferDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.rewardsService.createPartnerOffer(user, dto, image);
  }

  @Post('stores')
  @ApiOperation({ summary: 'Create a partner store/branch location' })
  @ApiBody({ type: CreatePartnerStoreDto })
  createStore(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreatePartnerStoreDto,
  ) {
    return this.rewardsService.createPartnerStore(user, dto);
  }

  @Get('stores')
  @ApiOperation({ summary: 'Get my partner store/branch locations' })
  getStores(@CurrentUser() user: CurrentUserPayload) {
    return this.rewardsService.getPartnerStores(user);
  }

  @Get('stores/:storeId')
  @ApiOperation({ summary: 'Get one partner store/branch location' })
  @ApiParam({ name: 'storeId' })
  getStore(
    @CurrentUser() user: CurrentUserPayload,
    @Param('storeId') storeId: string,
  ) {
    return this.rewardsService.getPartnerStore(user, storeId);
  }

  @Patch('stores/:storeId')
  @ApiOperation({ summary: 'Update a partner store/branch location' })
  @ApiParam({ name: 'storeId' })
  @ApiBody({ type: UpdatePartnerStoreDto })
  updateStore(
    @CurrentUser() user: CurrentUserPayload,
    @Param('storeId') storeId: string,
    @Body() dto: UpdatePartnerStoreDto,
  ) {
    return this.rewardsService.updatePartnerStore(user, storeId, dto);
  }

  @Delete('stores/:storeId')
  @ApiOperation({ summary: 'Delete a partner store/branch location' })
  @ApiParam({ name: 'storeId' })
  deleteStore(
    @CurrentUser() user: CurrentUserPayload,
    @Param('storeId') storeId: string,
  ) {
    return this.rewardsService.deletePartnerStore(user, storeId);
  }

  @Get('offers')
  @ApiOperation({ summary: 'Get my partner reward offers' })
  getPartnerOffers(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: RewardOfferQueryDto,
  ) {
    return this.rewardsService.getPartnerOffers(user, query);
  }

  @Patch('offers/:offerId')
  @ApiOperation({ summary: 'Update my partner reward offer' })
  @ApiParam({ name: 'offerId' })
  @ApiBody({ type: UpdateRewardOfferDto })
  updateOffer(
    @CurrentUser() user: CurrentUserPayload,
    @Param('offerId') offerId: string,
    @Body() dto: UpdateRewardOfferDto,
  ) {
    return this.rewardsService.updatePartnerOffer(user, offerId, dto);
  }

  @Post('redemptions/:code/use')
  @ApiOperation({ summary: 'Verify and mark a redemption code as used' })
  @ApiParam({ name: 'code' })
  useRedemptionCode(
    @CurrentUser() user: CurrentUserPayload,
    @Param('code') code: string,
  ) {
    return this.rewardsService.useRedemptionCode(user, code);
  }

  @Post('redemptions/scan')
  @ApiOperation({ summary: 'Verify QR token or coupon/code and mark as used' })
  @ApiBody({ type: UseRedemptionDto })
  @Roles(UserRole.PARTNER, UserRole.PARENT, UserRole.NANNY)
  scanRedemption(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UseRedemptionDto,
  ) {
    return this.rewardsService.scanRedemption(user, dto);
  }
}
