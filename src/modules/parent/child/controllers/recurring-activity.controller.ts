import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { CreateRecurringActivityDto } from '../dto/create-recurring-activity.dto';
import { UpdateRecurringActivityDto } from '../dto/update-recurring-activity.dto';
import { RecurringActivityService } from '../services/recurring-activity.service';

@ApiTags('(Parent) > Children Manage > Recurring Activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('parent/children/:childId/recurring-activities')
export class RecurringActivityController {
  constructor(private readonly recurringActivityService: RecurringActivityService) { }

  @Post()
  @ApiOperation({ summary: 'Add a recurring activity for a child' })
  @ApiResponse({ status: 201, description: 'Recurring activity added successfully.' })
  addRecurringActivity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
    @Body() dto: CreateRecurringActivityDto,
  ) {
    return this.recurringActivityService.addRecurringActivity(user.userId, childId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all recurring activities for a child' })
  @ApiResponse({ status: 200, description: 'Recurring activities returned successfully.' })
  getRecurringActivities(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
  ) {
    return this.recurringActivityService.getRecurringActivities(user.userId, childId);
  }

  @Patch(':activityId')
  @ApiOperation({ summary: 'Update a specific recurring activity' })
  @ApiResponse({ status: 200, description: 'Recurring activity updated successfully.' })
  updateRecurringActivity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
    @Param('activityId') activityId: string,
    @Body() dto: UpdateRecurringActivityDto,
  ) {
    return this.recurringActivityService.updateRecurringActivity(user.userId, childId, activityId, dto);
  }

  @Delete(':activityId')
  @ApiOperation({ summary: 'Delete a specific recurring activity' })
  @ApiResponse({ status: 200, description: 'Recurring activity deleted successfully.' })
  deleteRecurringActivity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
    @Param('activityId') activityId: string,
  ) {
    return this.recurringActivityService.deleteRecurringActivity(user.userId, childId, activityId);
  }
}
