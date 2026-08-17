import {
  Body,
  Controller,
  Delete,
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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateManageSystemInvitationDto } from './dto/create-manage-system-invitation.dto';
import { SearchManageSystemDto } from './dto/search-manage-system.dto';
import { UpdateManageSystemPermissionsDto } from './dto/update-manage-system-permissions.dto';
import { ManageSystemService } from './manage-system.service';

@ApiTags('Manage System')
@Controller('manage-system')
export class ManageSystemController {
  constructor(private readonly manageSystemService: ManageSystemService) {}

  @Get('caregivers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Screen 1: Get account owner and categorized caregivers (Nanny, Parent, Family Member)',
    description:
      'Returns Account Owner and list of invited members grouped into sections: Account Owner, Nanny, Parent, Family Member.',
  })
  getManageCaregivers(@CurrentUser() user: CurrentUserPayload) {
    return this.manageSystemService.getManageCaregivers(user.userId);
  }

  @Get('children')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Screen 2: Get child picker list for account owner',
    description:
      'Returns list of children owned by or accessible to the account owner with image, name, birthDate, and formatted age.',
  })
  getMyChildren(@CurrentUser() user: CurrentUserPayload) {
    return this.manageSystemService.getMyChildren(user.userId);
  }

  @Get('search-user')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Screen 5 ("On Platform"): Search registered users by email or name',
    description:
      'Searches active registered users by email or name to select and invite on platform.',
  })
  searchUsers(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: SearchManageSystemDto,
  ) {
    return this.manageSystemService.searchUsers(user.userId, query);
  }

  @Post('children/:childId/invite')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Screen 5: Create and send invitation to Nanny, Parent, or Family Member',
    description:
      'Invites caregiver by selected child, role (NANNY, PARENT, FAMILY_MEMBER), relationship (FATHER, MOTHER, GRANDMOTHER, etc.), and permission toggles.',
  })
  @ApiParam({ name: 'childId', description: 'Child ID' })
  @ApiBody({ type: CreateManageSystemInvitationDto })
  createInvitation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
    @Body() dto: CreateManageSystemInvitationDto,
  ) {
    return this.manageSystemService.createInvitation(user.userId, childId, dto);
  }

  @Get('invitations/:token')
  @ApiOperation({ summary: 'Preview caregiver invitation details by token' })
  @ApiParam({ name: 'token', description: 'Invitation token' })
  previewInvitation(@Param('token') token: string) {
    return this.manageSystemService.previewInvitation(token);
  }

  @Post('invitations/:token/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept caregiver invitation after login' })
  @ApiParam({ name: 'token', description: 'Invitation token' })
  acceptInvitation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('token') token: string,
  ) {
    return this.manageSystemService.acceptInvitation(user.userId, token);
  }

  @Post('invitations/:token/decline')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Decline caregiver invitation' })
  @ApiParam({ name: 'token', description: 'Invitation token' })
  declineInvitation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('token') token: string,
  ) {
    return this.manageSystemService.declineInvitation(user.userId, token);
  }

  @Get('invitations/:token/accept-html')
  @ApiOperation({ summary: 'Direct Accept link for email button click' })
  @ApiParam({ name: 'token', description: 'Invitation token' })
  async acceptInvitationHtml(@Param('token') token: string, @Res() res: any) {
    const result = await this.manageSystemService.acceptInvitationHtml(token);
    if (result.redirectUrl) {
      return res.redirect(result.redirectUrl);
    }
    res.setHeader('Content-Type', 'text/html');
    return res.send(result.html);
  }

  @Post('invitations/accept-signup')
  @ApiOperation({ summary: 'Create account and auto-accept caregiver invitation in one step' })
  acceptSignupInvitation(
    @Body()
    dto: {
      token: string;
      fullName: string;
      email: string;
      password: string;
      phoneNumber?: string;
      role?: string;
    },
  ) {
    return this.manageSystemService.acceptSignupInvitation(dto);
  }

  @Get('invitations/:token/decline-html')
  @ApiOperation({ summary: 'Direct Decline link for email button click' })
  @ApiParam({ name: 'token', description: 'Invitation token' })
  async declineInvitationHtml(@Param('token') token: string, @Res() res: any) {
    const html = await this.manageSystemService.declineInvitationHtml(token);
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  }

  @Get('access/:accessId/permissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Screen 4: Get caregiver or Nanny permissions for permission modal',
    description:
      'Retrieves permission toggles and label descriptions for a specific caregiver access ID.',
  })
  @ApiParam({ name: 'accessId', description: 'Caregiver access ID' })
  getPermissions(
    @CurrentUser() user: CurrentUserPayload,
    @Param('accessId') accessId: string,
  ) {
    return this.manageSystemService.getPermissions(user.userId, accessId);
  }

  @Patch('access/:accessId/permissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Screen 4: Update caregiver or Nanny permissions',
    description:
      'Updates permission toggles (e.g. manageDailyPlans, manageGroceryLists, editChildProfile, accessChildInsights).',
  })
  @ApiParam({ name: 'accessId', description: 'Caregiver access ID' })
  @ApiBody({ type: UpdateManageSystemPermissionsDto })
  updatePermissions(
    @CurrentUser() user: CurrentUserPayload,
    @Param('accessId') accessId: string,
    @Body() dto: UpdateManageSystemPermissionsDto,
  ) {
    return this.manageSystemService.updatePermissions(user.userId, accessId, dto);
  }

  @Delete('access/:accessId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Screen 1: Revoke or remove caregiver or Nanny access',
    description: 'Revokes caregiver access record and invalidates invite token.',
  })
  @ApiParam({ name: 'accessId', description: 'Caregiver access ID' })
  removeAccess(
    @CurrentUser() user: CurrentUserPayload,
    @Param('accessId') accessId: string,
  ) {
    return this.manageSystemService.removeAccess(user.userId, accessId);
  }
}
