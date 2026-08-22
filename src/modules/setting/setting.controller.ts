import { Controller, Patch, Post, Get, Body, UseGuards, Param, Query } from '@nestjs/common';
import { SettingService } from './setting.service';
import {
  ChangePasswordDto,
  CreateStripeOnboardingLinkDto,
  DeleteAccountDto,
  SavePayoutMethodDto,
  UpdateMembershipRoutingDto,
} from './dto/setting.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Setting')
@ApiBearerAuth()
@Controller('setting')
export class SettingController {
  constructor(private readonly settingService: SettingService) {}

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid current password.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async changePassword(
    @CurrentUser() user: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.settingService.changePassword(user.id, changePasswordDto);
  }

  @Post('delete-account')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Soft delete account and submit feedback' })
  @ApiResponse({ status: 200, description: 'Account deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async deleteAccount(
    @CurrentUser() user: any,
    @Body() deleteAccountDto: DeleteAccountDto,
  ) {
    return this.settingService.deleteAccount(user.id, deleteAccountDto);
  }

  @Get('deleted-accounts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get all deleted accounts feedback (Admin only)' })
  @ApiResponse({ status: 200, description: 'Returns deleted accounts feedback.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Admin only.' })
  async getDeletedAccounts() {
    return this.settingService.getDeletedAccounts();
  }

  @Get('deleted-accounts/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get a specific deleted account feedback by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Returns specific deleted account feedback.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Admin only.' })
  @ApiResponse({ status: 404, description: 'Deleted account record not found.' })
  async getDeletedAccountById(@Param('id') id: string) {
    return this.settingService.getDeletedAccountById(id);
  }

  @Get('payout-methods/me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get my payout/receiving methods' })
  async getMyPayoutMethods(@CurrentUser() user: any) {
    return this.settingService.getMyPayoutMethods(user.id);
  }

  @Post('payout-methods/me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Save my payout/receiving method for nanny/admin/partner payments' })
  async saveMyPayoutMethod(
    @CurrentUser() user: any,
    @Body() dto: SavePayoutMethodDto,
  ) {
    return this.settingService.saveMyPayoutMethod(user.id, dto);
  }

  @Post('payout-methods/stripe/onboarding-link')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Create or reuse a Stripe connected account and return an onboarding link for partner payouts',
  })
  async createStripeOnboardingLink(
    @CurrentUser() user: any,
    @Body() dto: CreateStripeOnboardingLinkDto,
  ) {
    return this.settingService.createStripeOnboardingLink(user.id, dto);
  }

  @Get('payout-methods/stripe/status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Get Stripe connected-account onboarding status for the logged-in partner',
  })
  async getStripeConnectStatus(@CurrentUser() user: any) {
    return this.settingService.getStripeConnectStatus(user.id);
  }

  @Patch('payout-methods/:id/default')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Set one payout method as default for incoming payments' })
  async setDefaultPayoutMethod(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.settingService.setDefaultPayoutMethod(user.id, id);
  }

  @Patch('payout-methods/:id/remove-default')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Remove default marker from a payout method' })
  async removeDefaultPayoutMethod(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.settingService.removeDefaultPayoutMethod(user.id, id);
  }

  @Get('payment-routing')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get payment routing summary for nanny tips, membership, and partner products' })
  async getPaymentRoutingOverview() {
    return this.settingService.getPaymentRoutingOverview();
  }

  @Patch('payment-routing/membership-subscription')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Choose which admin account receives membership subscription payments' })
  async updateMembershipRouting(@Body() dto: UpdateMembershipRoutingDto) {
    return this.settingService.updateMembershipRouting(dto);
  }

  @Get('payment-routing/resolve')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Resolve who should receive a payment for a specific context' })
  async resolvePaymentRouting(
    @Query('context') context: string,
    @Query('nannyUserId') nannyUserId?: string,
    @Query('productId') productId?: string,
  ) {
    return this.settingService.resolvePaymentRecipient(context, {
      nannyUserId,
      productId,
    });
  }
}
