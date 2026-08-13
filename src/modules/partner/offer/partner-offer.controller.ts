import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import {
  CreatePartnerOfferDto,
  PartnerOfferQueryDto,
  UpdatePartnerOfferDto,
} from './dto/partner-offer.dto';
import { PartnerOfferService } from './partner-offer.service';

@ApiTags('Partner Offers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARTNER)
@Controller('partner/offers')
export class PartnerOfferController {
  constructor(private readonly partnerOfferService: PartnerOfferService) {}

  @Post()
  @ApiOperation({
    summary: 'Create partner offer draft or submit for admin review',
    description:
      'Save Draft sends status=DRAFT. Submit for review sends status=PENDING_APPROVAL or omits status. Admin approval is required before publishing.',
  })
  @ApiBody({ type: CreatePartnerOfferDto })
  createOffer(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreatePartnerOfferDto,
  ) {
    return this.partnerOfferService.createOffer(user, dto);
  }

  @Get()
  @Roles(UserRole.PARTNER, UserRole.PARENT, UserRole.NANNY, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get partner offers',
    description:
      'Partners see their own offers across all statuses. Other users see approved public offers only.',
  })
  getOffers(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PartnerOfferQueryDto,
  ) {
    return this.partnerOfferService.getOffersForUser(user, query);
  }

  @Get('outlets')
  @ApiOperation({
    summary: 'Search my partner outlet locations for offer availability',
  })
  getMyOutlets(
    @CurrentUser() user: CurrentUserPayload,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.partnerOfferService.getMyOutlets(user, {
      search,
      limit: Number(limit) || 10,
    });
  }

  @Get(':offerId')
  @Roles(UserRole.PARTNER, UserRole.PARENT, UserRole.NANNY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get one partner offer' })
  @ApiParam({ name: 'offerId' })
  getOffer(
    @CurrentUser() user: CurrentUserPayload,
    @Param('offerId') offerId: string,
  ) {
    return this.partnerOfferService.getOfferForUser(user, offerId);
  }

  @Get(':offerId/qr-code')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Download approved offer QR code as PNG' })
  @ApiParam({ name: 'offerId' })
  async downloadQrCode(
    @CurrentUser() user: CurrentUserPayload,
    @Param('offerId') offerId: string,
    @Res() res: Response,
  ) {
    const file = await this.partnerOfferService.getQrCodeFile(user, offerId);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.buffer);
  }

  @Get(':offerId/qr-code/:format')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Download approved offer QR code as PNG, JPG, or JPEG',
  })
  @ApiParam({ name: 'offerId' })
  @ApiParam({ name: 'format', enum: ['png', 'jpg', 'jpeg'] })
  async downloadQrCodeByFormat(
    @CurrentUser() user: CurrentUserPayload,
    @Param('offerId') offerId: string,
    @Param('format') format: 'png' | 'jpg' | 'jpeg',
    @Res() res: Response,
  ) {
    const file = await this.partnerOfferService.getQrCodeFile(
      user,
      offerId,
      format,
    );
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.buffer);
  }

  @Get(':offerId/pdf-kit')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Download approved offer printable PDF kit' })
  @ApiParam({ name: 'offerId' })
  async downloadPdfKit(
    @CurrentUser() user: CurrentUserPayload,
    @Param('offerId') offerId: string,
    @Res() res: Response,
  ) {
    const file = await this.partnerOfferService.getPdfKitFile(user, offerId);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.buffer);
  }

  @Post(':offerId/scan')
  @Roles(UserRole.PARENT, UserRole.NANNY, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Accept/redeem an offer after scanning its QR code',
  })
  @ApiParam({ name: 'offerId' })
  acceptScannedOffer(
    @CurrentUser() user: CurrentUserPayload,
    @Param('offerId') offerId: string,
  ) {
    return this.partnerOfferService.acceptScannedOffer(user, offerId);
  }

  @Patch(':offerId')
  @ApiOperation({
    summary: 'Update draft/rejected partner offer or resubmit for review',
  })
  @ApiParam({ name: 'offerId' })
  @ApiBody({ type: UpdatePartnerOfferDto })
  updateOffer(
    @CurrentUser() user: CurrentUserPayload,
    @Param('offerId') offerId: string,
    @Body() dto: UpdatePartnerOfferDto,
  ) {
    return this.partnerOfferService.updateMyOffer(user, offerId, dto);
  }
}
