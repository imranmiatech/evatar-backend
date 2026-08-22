import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ChildService } from './child.service';

@ApiTags('Manage System / Children')
@Controller('manage-system')
export class ChildController {
  constructor(private readonly childService: ChildService) {}

  @Get('children')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Screen 2: Get child picker list for account owner',
    description:
      'Returns list of children owned by or accessible to the account owner with image, name, birthDate, and formatted age.',
  })
  getMyChildren(@CurrentUser() user: CurrentUserPayload) {
    return this.childService.getMyChildren(user.userId);
  }

  @Get('children/:childId/my-permissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get my effective access and permissions for a specific child',
    description:
      'Returns whether the current user is the account owner or a delegated caregiver, together with effective permissions for that child.',
  })
  @ApiParam({ name: 'childId', description: 'Child ID' })
  getMyChildPermissions(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
  ) {
    return this.childService.getMyChildPermissions(user.userId, childId);
  }
}
