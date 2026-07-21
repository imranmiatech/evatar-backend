import { Controller, Patch, Post, Get, Body, UseGuards, Param } from '@nestjs/common';
import { SettingService } from './setting.service';
import { ChangePasswordDto, DeleteAccountDto } from './dto/setting.dto';
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
}
