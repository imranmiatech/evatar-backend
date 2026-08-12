import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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
import { UpdateCaregiverPermissionsDto } from '../dto/update-caregiver-permissions.dto';
import {
  ManageFamilyAccessPermissionDto,
  ManageNannyAccessPermissionDto,
  ManageParentAccessPermissionDto,
} from './dto/manage-access-permission.dto';
import { PermissionService } from './permission.service';

@ApiTags('Caregiver Permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('caregivers/permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get('access/:accessId')
  @ApiOperation({ summary: 'Get permissions for an existing access' })
  @ApiParam({ name: 'accessId', description: 'Caregiver access ID' })
  getAccessPermissions(
    @CurrentUser() user: CurrentUserPayload,
    @Param('accessId') accessId: string,
  ) {
    return this.permissionService.getAccessPermissions(user.userId, accessId);
  }

  @Get('access/:accessId/nanny')
  @ApiOperation({ summary: 'Get nanny permissions for an existing access' })
  @ApiParam({ name: 'accessId', description: 'Nanny caregiver access ID' })
  getNannyPermissions(
    @CurrentUser() user: CurrentUserPayload,
    @Param('accessId') accessId: string,
  ) {
    return this.permissionService.getNannyPermissions(user.userId, accessId);
  }

  @Get('access/:accessId/parent')
  @ApiOperation({ summary: 'Get parent permissions for an existing access' })
  @ApiParam({ name: 'accessId', description: 'Parent caregiver access ID' })
  getParentPermissions(
    @CurrentUser() user: CurrentUserPayload,
    @Param('accessId') accessId: string,
  ) {
    return this.permissionService.getParentPermissions(user.userId, accessId);
  }

  @Get('access/:accessId/family')
  @ApiOperation({ summary: 'Get family permissions for an existing access' })
  @ApiParam({ name: 'accessId', description: 'Family caregiver access ID' })
  getFamilyPermissions(
    @CurrentUser() user: CurrentUserPayload,
    @Param('accessId') accessId: string,
  ) {
    return this.permissionService.getFamilyPermissions(user.userId, accessId);
  }

  @Post('access/:accessId/nanny')
  @ApiOperation({ summary: 'Save nanny permissions for an existing access' })
  @ApiParam({ name: 'accessId', description: 'Nanny caregiver access ID' })
  @ApiBody({ type: ManageNannyAccessPermissionDto })
  saveNannyPermissions(
    @CurrentUser() user: CurrentUserPayload,
    @Param('accessId') accessId: string,
    @Body() dto: ManageNannyAccessPermissionDto,
  ) {
    return this.permissionService.saveNannyPermissions(
      user.userId,
      accessId,
      dto,
    );
  }

  @Post('access/:accessId/parent')
  @ApiOperation({ summary: 'Save parent permissions for an existing access' })
  @ApiParam({ name: 'accessId', description: 'Parent caregiver access ID' })
  @ApiBody({ type: ManageParentAccessPermissionDto })
  saveParentPermissions(
    @CurrentUser() user: CurrentUserPayload,
    @Param('accessId') accessId: string,
    @Body() dto: ManageParentAccessPermissionDto,
  ) {
    return this.permissionService.saveParentPermissions(
      user.userId,
      accessId,
      dto,
    );
  }

  @Post('access/:accessId/family')
  @ApiOperation({ summary: 'Save family permissions for an existing access' })
  @ApiParam({ name: 'accessId', description: 'Family caregiver access ID' })
  @ApiBody({ type: ManageFamilyAccessPermissionDto })
  saveFamilyPermissions(
    @CurrentUser() user: CurrentUserPayload,
    @Param('accessId') accessId: string,
    @Body() dto: ManageFamilyAccessPermissionDto,
  ) {
    return this.permissionService.saveFamilyPermissions(
      user.userId,
      accessId,
      dto,
    );
  }

  @Patch('access/:accessId')
  @ApiOperation({ summary: 'Update access permissions' })
  @ApiParam({ name: 'accessId', description: 'Caregiver access ID' })
  @ApiBody({ type: UpdateCaregiverPermissionsDto })
  updateAccess(
    @CurrentUser() user: CurrentUserPayload,
    @Param('accessId') accessId: string,
    @Body() dto: UpdateCaregiverPermissionsDto,
  ) {
    return this.permissionService.updateAccess(user.userId, accessId, dto);
  }
}
