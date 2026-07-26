import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ChildTimelineService } from '../services/child-timeline.service';
import { ChildDailyTimelineQueryDto } from '../dto/child-daily-timeline-query.dto';

@ApiTags('(Parent) > Children Manage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARENT)
@Controller('parent/children')
export class ChildTimelineController {
  constructor(private readonly childTimelineService: ChildTimelineService) { }

  @Get(':childId/daily-timeline')
  @ApiOperation({
    summary: "Get child's daily timeline",
    description:
      'Returns a chronologically sorted timeline for the given child and date. Includes wake-up, school time, nap windows, all scheduled activities/recipes, and bedtime.',
  })
  @ApiParam({ name: 'childId', description: 'Child ID' })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Target date (ISO 8601, e.g. 2024-11-16). Defaults to today.',
    example: '2024-11-16',
  })
  @ApiResponse({ status: 200, description: 'Daily timeline returned successfully.' })
  @ApiResponse({ status: 404, description: 'Child not found.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  getChildDailyTimeline(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
    @Query() query: ChildDailyTimelineQueryDto,
  ) {
    return this.childTimelineService.getChildDailyTimeline(user.userId, childId, query);
  }
}
