import {
  Body,
  Controller,
  Get,
  Param,
  Post,
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
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CreateManageSystemInvitationDto } from './dto/create-manage-system-invitation.dto';
import { InvitationService } from './invitation.service';

@ApiTags('Manage System / Invitations')
@Controller('manage-system')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

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
    return this.invitationService.createInvitation(user.userId, childId, dto);
  }

  @Get('invitations/:token')
  @ApiOperation({ summary: 'Preview caregiver invitation details by token' })
  @ApiParam({ name: 'token', description: 'Invitation token' })
  previewInvitation(@Param('token') token: string) {
    return this.invitationService.previewInvitation(token);
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
    return this.invitationService.acceptInvitation(user.userId, token);
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
    return this.invitationService.declineInvitation(user.userId, token);
  }

  @Get('invitations/:token/accept-html')
  @ApiOperation({ summary: 'Direct Accept link for email button click' })
  @ApiParam({ name: 'token', description: 'Invitation token' })
  async acceptInvitationHtml(@Param('token') token: string, @Res() res: any) {
    const result = await this.invitationService.acceptInvitationHtml(token);
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
    return this.invitationService.acceptSignupInvitation(dto);
  }

  @Get('invitations/:token/decline-html')
  @ApiOperation({ summary: 'Direct Decline link for email button click' })
  @ApiParam({ name: 'token', description: 'Invitation token' })
  async declineInvitationHtml(@Param('token') token: string, @Res() res: any) {
    const html = await this.invitationService.declineInvitationHtml(token);
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  }
}
