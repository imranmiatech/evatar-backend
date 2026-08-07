import { Controller, Get, Patch, Post, Delete, Query, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminUsersService } from './admin-users.service';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { ExtendTrialDto } from './dto/extend-trial.dto';
import { ChangeUserPlanDto } from './dto/change-user-plan.dto';
import { SendUserMessageDto } from './dto/send-user-message.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('Admin User Management')
@ApiBearerAuth()
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get overview metric cards (Total, Active Today, New, Trial, Paid, Suspended) & Per Enum Counts' })
  @ApiResponse({ status: 200, description: 'Return metrics and enum counts.' })
  async getUserStats() {
    return this.adminUsersService.getUserStats();
  }

  @Get('plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get available subscription plans for Upgrade/Change plan modal' })
  @ApiResponse({ status: 200, description: 'Return list of active subscription plans.' })
  async getSubscriptionPlans() {
    return this.adminUsersService.getSubscriptionPlans();
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get user list with search, role, status, and plan filters' })
  @ApiResponse({ status: 200, description: 'Return user list with pagination meta.' })
  async getUsers(@Query() query: AdminUserQueryDto) {
    return this.adminUsersService.getUsers(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get comprehensive details of a user across all 7 dashboard tabs' })
  @ApiResponse({ status: 200, description: 'Return complete multi-tab user profile details.' })
  async getUserById(@Param('id') id: string) {
    return this.adminUsersService.getUserById(id);
  }

  // Individual Tab Endpoints for Async Loading
  @Get(':id/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get Profile Tab data for a user' })
  async getUserProfileTab(@Param('id') id: string) {
    return this.adminUsersService.getUserProfileTab(id);
  }

  @Get(':id/family')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get Family Tab data (children, partner, assigned nanny) for a user' })
  async getUserFamilyTab(@Param('id') id: string) {
    return this.adminUsersService.getUserFamilyTab(id);
  }

  @Get(':id/membership')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get Membership Tab data for a user' })
  async getUserMembershipTab(@Param('id') id: string) {
    return this.adminUsersService.getUserMembershipTab(id);
  }

  @Get(':id/rewards')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get Rewards Tab data for a user' })
  async getUserRewardsTab(@Param('id') id: string) {
    return this.adminUsersService.getUserRewardsTab(id);
  }

  @Get(':id/documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get Documents Tab data (Passport, ID files) for a user' })
  async getUserDocumentsTab(@Param('id') id: string) {
    return this.adminUsersService.getUserDocumentsTab(id);
  }

  @Get(':id/analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get Analytics Tab data (feature usage %) for a user' })
  async getUserAnalyticsTab(@Param('id') id: string) {
    return this.adminUsersService.getUserAnalyticsTab(id);
  }

  @Get(':id/ai-usage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get AI Usage Tab data for a user' })
  async getUserAiUsageTab(@Param('id') id: string) {
    return this.adminUsersService.getUserAiUsageTab(id);
  }

  // Action Endpoints
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Edit user profile, role, status, or plan' })
  @ApiResponse({ status: 200, description: 'User updated successfully.' })
  async updateUser(@Param('id') id: string, @Body() dto: UpdateAdminUserDto) {
    return this.adminUsersService.updateUser(id, dto);
  }

  @Patch(':id/extend-trial')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Extend user free trial period by specified days' })
  @ApiResponse({ status: 200, description: 'Trial extended successfully.' })
  async extendTrial(@Param('id') id: string, @Body() dto: ExtendTrialDto) {
    return this.adminUsersService.extendTrial(id, dto);
  }

  @Patch(':id/plan')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Upgrade or change user subscription plan' })
  @ApiResponse({ status: 200, description: 'User plan updated successfully.' })
  async changeUserPlan(@Param('id') id: string, @Body() dto: ChangeUserPlanDto) {
    return this.adminUsersService.changeUserPlan(id, dto);
  }

  @Patch(':id/suspend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Suspend or activate a user account' })
  @ApiResponse({ status: 200, description: 'User status toggled successfully.' })
  async suspendUser(@Param('id') id: string, @Body('suspend') suspend: boolean) {
    return this.adminUsersService.suspendUser(id, suspend);
  }

  @Patch(':id/cancel-subscription')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Cancel user active subscription' })
  @ApiResponse({ status: 200, description: 'Subscription cancelled successfully.' })
  async cancelSubscription(@Param('id') id: string) {
    return this.adminUsersService.cancelSubscription(id);
  }

  @Post(':id/send-message')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Send direct email/notification message to user' })
  @ApiResponse({ status: 200, description: 'Message sent successfully.' })
  async sendUserMessage(@Param('id') id: string, @Body() dto: SendUserMessageDto) {
    return this.adminUsersService.sendUserMessage(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 200, description: 'User deleted successfully.' })
  async deleteUser(@Param('id') id: string) {
    return this.adminUsersService.deleteUser(id);
  }
}
