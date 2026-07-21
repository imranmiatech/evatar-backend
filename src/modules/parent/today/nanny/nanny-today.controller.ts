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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import {
  NannyBedtimeSubmissionDto,
  NannyTaskSubmissionDto,
  NannyTimelineQueryDto,
} from './dto';
import { NannyTodayService } from './nanny-today.service';

const timelineExample = {
  nanny: {
    id: 'nanny-user-id',
    fullName: 'Deepa Kumari',
    profilePictureUrl: 'https://cdn.example.com/nanny.jpg',
  },
  children: [
    {
      id: 'seed-child-eve',
      name: 'Eve',
      avatarUrl: 'https://cdn.example.com/eve.jpg',
      nannyPermissions: {
        canViewStory: true,
        canUpdateProof: true,
      },
    },
  ],
  selectedChild: {
    id: 'seed-child-eve',
    name: 'Eve',
  },
  dayPlan: {
    id: 'day-plan-id',
    title: "Eve's Magical Forest Day",
    date: '2026-07-20T00:00:00.000Z',
    status: 'READY',
  },
  timeline: [
    {
      type: 'activity',
      activityId: 'activity-id',
      category: 'BREAKFAST',
      title: 'Breakfast',
      subtitle: 'Chicken & Rice Bowl',
      timeLabel: '12:30 PM - 1:00 PM',
      status: 'PLANNED',
      hasRecipe: true,
      recipeId: 'recipe-id',
      proofRequired: true,
    },
    {
      type: 'story',
      storyId: 'story-id',
      category: 'BEDTIME_STORY',
      title: "Today's bedtime story",
      subtitle: 'Eve and the Moonbeam Forest',
      proofRequired: false,
    },
  ],
  bedtimeStory: {
    id: 'story-id',
    title: 'Eve and the Moonbeam Forest',
  },
  permissions: {
    canUpdateProof: true,
    canViewStory: true,
    canSubmitTask: true,
  },
};

@ApiTags('Nanny Today')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('today/nanny')
export class NannyTodayController {
  constructor(private readonly nannyTodayService: NannyTodayService) {}

  @Get('timeline')
  @ApiOperation({
    summary: 'Nanny Today timeline for assigned child',
    description:
      'Loads the nanny home Today timeline: child selector, routine items, assigned tasks, recipe markers, and bedtime story.',
  })
  @ApiQuery({ name: 'childId', required: false, example: 'seed-child-eve' })
  @ApiQuery({ name: 'date', required: false, example: '2026-07-20' })
  @ApiResponse({
    status: 200,
    description: 'Timeline response for nanny Today screen.',
    schema: { example: timelineExample },
  })
  getTimeline(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: NannyTimelineQueryDto,
  ) {
    return this.nannyTodayService.getTimeline(user, query.childId, query.date);
  }

  @Get('tasks/:activityId')
  @ApiOperation({
    summary: 'Nanny task detail',
    description:
      'Loads task detail, recipe assignment, proof state, developer note, and submission status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Task detail response for nanny task detail screen.',
  })
  getTaskDetail(
    @CurrentUser() user: CurrentUserPayload,
    @Param('activityId') activityId: string,
  ) {
    return this.nannyTodayService.getTaskDetail(user, activityId);
  }

  @Get('tasks/:activityId/recipe')
  @ApiOperation({
    summary: 'Recipe assigned to nanny task',
    description:
      'Returns the full Kitchen recipe assigned through KitchenSchedule.dayActivityId.',
  })
  getTaskRecipe(
    @CurrentUser() user: CurrentUserPayload,
    @Param('activityId') activityId: string,
  ) {
    return this.nannyTodayService.getTaskRecipe(user, activityId);
  }

  @Post('tasks/:activityId/submissions')
  @ApiOperation({
    summary: 'Nanny submits task completion/proof/feedback',
    description:
      'Stores task submission in DayActivity.detail.nannySubmission and updates activity status/proof fields.',
  })
  @ApiBody({ type: NannyTaskSubmissionDto })
  submitTask(
    @CurrentUser() user: CurrentUserPayload,
    @Param('activityId') activityId: string,
    @Body() dto: NannyTaskSubmissionDto,
  ) {
    return this.nannyTodayService.submitTask(user, activityId, dto);
  }

  @Get('bedtime/:storyId')
  @ApiOperation({
    summary: 'Nanny bedtime story playback/detail',
    description:
      'Loads bedtime story text, parent recording metadata, child context, and nanny submission state.',
  })
  getBedtime(
    @CurrentUser() user: CurrentUserPayload,
    @Param('storyId') storyId: string,
  ) {
    return this.nannyTodayService.getBedtime(user, storyId);
  }

  @Post('bedtime/:storyId/submissions')
  @ApiOperation({
    summary: 'Nanny submits bedtime story feedback',
    description:
      'Stores bedtime feedback inside the day plan aiOutput.nannyBedtimeSubmissions map.',
  })
  @ApiBody({ type: NannyBedtimeSubmissionDto })
  submitBedtime(
    @CurrentUser() user: CurrentUserPayload,
    @Param('storyId') storyId: string,
    @Body() dto: NannyBedtimeSubmissionDto,
  ) {
    return this.nannyTodayService.submitBedtime(user, storyId, dto);
  }
}
