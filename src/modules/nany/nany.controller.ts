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
import { CreateNannyInvitationDto } from './dto/create-nanny-invitation.dto';
import { NannyProfileQueryDto } from './dto/nanny-profile-query.dto';
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

  @Get(':nannyUserId/profile')
  @ApiOperation({
    summary: 'Get a nanny profile dashboard for one child/family',
    description:
      'Returns the nanny header, overview stats, computed task points, period task counts, recent tasks, and portfolio highlights in one response.',
  })
  @ApiParam({ name: 'nannyUserId', description: 'Nanny user ID' })
  @ApiQuery({ name: 'childId', required: true, description: 'Child ID' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['overview', 'week', 'month'],
    description: 'Task range to include. Defaults to overview.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum task rows to return. Defaults to 10.',
  })
  getNannyProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Param('nannyUserId') nannyUserId: string,
    @Query() query: NannyProfileQueryDto,
  ) {
    return this.nanyService.getNannyProfile(user, nannyUserId, query);
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
