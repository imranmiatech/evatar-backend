import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CaregiverService } from './caregiver.service';
import { CreateCaregiverInvitationDto } from './dto/create-caregiver-invitation.dto';
import { ListNanniesDto } from './dto/list-nannies.dto';
import { SearchCaregiversDto } from './dto/search-caregivers.dto';
import { UpdateCaregiverPermissionsDto } from './dto/update-caregiver-permissions.dto';

@ApiTags('Caregivers')
@Controller('caregivers')
export class CaregiverController {
  constructor(private readonly caregiverService: CaregiverService) {}

  @Get('search')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search existing app users for caregiver invite' })
  searchUsers(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: SearchCaregiversDto,
  ) {
    return this.caregiverService.searchUsers(user.userId, query);
  }

  @Get('nannies')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all nanny users in the app' })
  listNannies(@Query() query: ListNanniesDto) {
    return this.caregiverService.listNannies(query);
  }

  @Get('children/:childId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get account owner and caregivers for a child' })
  @ApiParam({ name: 'childId', description: 'Child ID' })
  getChildCaregivers(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
  ) {
    return this.caregiverService.getChildCaregivers(user.userId, childId);
  }

  @Post('children/:childId/invitations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invite caregiver, parent, or family member' })
  @ApiParam({ name: 'childId', description: 'Child ID' })
  @ApiBody({ type: CreateCaregiverInvitationDto })
  createInvitation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
    @Body() dto: CreateCaregiverInvitationDto,
  ) {
    return this.caregiverService.createInvitation(user.userId, childId, dto);
  }

  @Get('invitations/:token')
  @ApiOperation({ summary: 'Preview caregiver invitation by token' })
  @ApiParam({ name: 'token', description: 'Invitation token' })
  previewInvitation(@Param('token') token: string) {
    return this.caregiverService.previewInvitation(token);
  }

  @Post('invitations/:token/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept caregiver invitation after login/signup' })
  @ApiParam({ name: 'token', description: 'Invitation token' })
  acceptInvitation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('token') token: string,
  ) {
    return this.caregiverService.acceptInvitation(user.userId, token);
  }

  @Get('access/:accessId/permissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get caregiver permissions for permission modal' })
  @ApiParam({ name: 'accessId', description: 'Caregiver access ID' })
  getPermissions(
    @CurrentUser() user: CurrentUserPayload,
    @Param('accessId') accessId: string,
  ) {
    return this.caregiverService.getPermissions(user.userId, accessId);
  }

  @Patch('access/:accessId/permissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update caregiver permissions' })
  @ApiParam({ name: 'accessId', description: 'Caregiver access ID' })
  updatePermissions(
    @CurrentUser() user: CurrentUserPayload,
    @Param('accessId') accessId: string,
    @Body() dto: UpdateCaregiverPermissionsDto,
  ) {
    return this.caregiverService.updatePermissions(user.userId, accessId, dto);
  }

  @Delete('access/:accessId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove or revoke caregiver access' })
  @ApiParam({ name: 'accessId', description: 'Caregiver access ID' })
  removeAccess(
    @CurrentUser() user: CurrentUserPayload,
    @Param('accessId') accessId: string,
  ) {
    return this.caregiverService.removeAccess(user.userId, accessId);
  }

  @Delete('members/:accessId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Remove any nanny, parent, or family member from a child care team',
  })
  @ApiParam({ name: 'accessId', description: 'Caregiver access ID' })
  removeMember(
    @CurrentUser() user: CurrentUserPayload,
    @Param('accessId') accessId: string,
  ) {
    return this.caregiverService.removeAccess(user.userId, accessId);
  }

  @Delete('nannies/:accessId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a nanny from a child care team' })
  @ApiParam({ name: 'accessId', description: 'Nanny caregiver access ID' })
  removeNanny(
    @CurrentUser() user: CurrentUserPayload,
    @Param('accessId') accessId: string,
  ) {
    return this.caregiverService.removeNannyAccess(user.userId, accessId);
  }
}
