import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NanyService } from './nany.service';

@ApiTags('Nanny')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('nanny')
export class NanyController {
  constructor(private readonly nanyService: NanyService) {}

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
