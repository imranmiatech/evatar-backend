import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
} from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CaregiverService } from './caregiver.service';
import { SearchManageSystemDto } from './dto/search-manage-system.dto';
import { UpdateManageSystemPermissionsDto } from './dto/update-manage-system-permissions.dto';

@ApiTags('Manage System / Caregivers')
@Controller('manage-system')
export class CaregiverController {
  constructor(private readonly caregiverService: CaregiverService) {}

  @Get('caregivers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Screen 1: Get account owner and categorized caregivers (Nanny, Parent, Family Member)',
    description:
      'Returns Account Owner and list of invited members grouped into sections: Account Owner, Nanny, Parent, Family Member.',
  })
  @ApiQuery({
    name: 'childId',
    required: false,
    description:
      'Optional child filter. When passed, returns caregiver data only for the selected accessible child.',
  })
  getManageCaregivers(
    @CurrentUser() user: CurrentUserPayload,
    @Query('childId') childId?: string,
  ) {
    return this.caregiverService.getManageCaregivers(user.userId, childId);
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
    return this.caregiverService.searchUsers(user.userId, query);
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
    return this.caregiverService.getPermissions(user.userId, accessId);
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
    return this.caregiverService.updatePermissions(user.userId, accessId, dto);
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
    return this.caregiverService.removeAccess(user.userId, accessId);
  }
}
