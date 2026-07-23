import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateNannyInvitationDto } from './dto/create-nanny-invitation.dto';
import { NanyService } from './nany.service';

@ApiTags('Nanny')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('nanny')
export class NanyController {
  constructor(private readonly nanyService: NanyService) {}

  @Post('invitations')
  @ApiOperation({ summary: 'Parent invites/links a nanny to a child' })
  @ApiBody({ type: CreateNannyInvitationDto })
  createInvitation(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateNannyInvitationDto,
  ) {
    return this.nanyService.createInvitation(user, dto);
  }

  @Get('invitations')
  @ApiOperation({ summary: 'Get invitations/child links for logged-in nanny' })
  getInvitations(@CurrentUser() user: CurrentUserPayload) {
    return this.nanyService.getMyInvitations(user);
  }

  @Post('invitations/:linkId/accept')
  @ApiOperation({ summary: 'Accept a parent invitation/child link' })
  acceptInvitation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('linkId') linkId: string,
  ) {
    return this.nanyService.acceptInvitation(user, linkId);
  }
}
