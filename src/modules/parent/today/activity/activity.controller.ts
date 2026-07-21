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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { AddActivityDto, CompleteProofDto, UpdateActivityDto } from '../dto';
import {
  ActivityFeedQueryDto,
  AddActivityFromTemplateDto,
  CreateActivityProofUploadUrlDto,
} from './dto';
import { ActivityService } from './activity.service';

const activityFeedExample = {
  child: {
    id: 'seed-child-eve',
    name: 'Eve',
    avatarUrl: 'https://cdn.example.com/eve.jpg',
  },
  dayPlan: {
    id: 'day-plan-id',
    title: "Eve's Magical Forest Day",
    status: 'READY',
    date: '2026-07-20T00:00:00.000Z',
  },
  activities: [
    {
      id: 'activity-id',
      category: 'OUTDOOR_PLAY',
      title: 'Color Hunt Discovery',
      description: 'A gentle outdoor exploration activity.',
      imageUrl: 'https://cdn.example.com/color-hunt.jpg',
      status: 'IN_PROGRESS',
      detail: {
        developmentalBenefits: [
          {
            title: 'Gross motor development',
            body: 'Supports movement, reaching, and balance.',
          },
        ],
        howToDoIt: ['Pick a color', 'Search safely', 'Name each discovery'],
        caregiverPrompts: ['What color did you find?'],
        progressionLevels: [
          {
            level: 'Level 1',
            body: 'Name simple colors and matching objects.',
          },
        ],
        safetyNotes: ['Stay within sight'],
      },
    },
  ],
  summary: {
    planned: 2,
    inProgress: 1,
    completed: 1,
    skipped: 0,
    total: 4,
  },
  permissions: {
    canEdit: true,
    canUpdateProof: false,
    canViewStory: true,
  },
};

@ApiTags('Activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('today')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('activity/parent/children/:childId/feed')
  @ApiOperation({
    summary: 'Parent activity feed for Activity screen list/detail',
  })
  @ApiQuery({ name: 'date', required: false, example: '2026-07-20' })
  @ApiResponse({
    status: 200,
    description: 'Parent feed with child, day plan, activities, summary, and permissions.',
    schema: { example: activityFeedExample },
  })
  getParentFeed(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
    @Query() query: ActivityFeedQueryDto,
  ) {
    return this.activityService.getParentFeed(user, childId, query.date);
  }

  @Get('activity/nanny/children/:childId/feed')
  @ApiTags('Nanny Activity')
  @ApiOperation({
    summary: 'Nanny activity feed for assigned child Activity screen',
  })
  @ApiQuery({ name: 'date', required: false, example: '2026-07-20' })
  @ApiResponse({
    status: 200,
    description: 'Nanny feed with update/proof permissions.',
    schema: {
      example: {
        ...activityFeedExample,
        permissions: {
          canEdit: false,
          canUpdateProof: true,
          canViewStory: true,
        },
      },
    },
  })
  getNannyFeed(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
    @Query() query: ActivityFeedQueryDto,
  ) {
    return this.activityService.getNannyFeed(user, childId, query.date);
  }

  @Get('activity/:activityId')
  @ApiOperation({ summary: 'Get single activity detail for parent or nanny' })
  @ApiResponse({
    status: 200,
    description: 'Activity detail with child/day plan context and proof media.',
  })
  getActivityDetail(
    @CurrentUser() user: CurrentUserPayload,
    @Param('activityId') activityId: string,
  ) {
    return this.activityService.getActivityDetail(user, activityId);
  }

  @Post(['activity/day-plans/:dayPlanId', 'day-plans/:dayPlanId/activities'])
  @ApiOperation({ summary: 'Parent adds manual activity to a day plan' })
  @ApiBody({ type: AddActivityDto })
  addActivity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dayPlanId') dayPlanId: string,
    @Body() dto: AddActivityDto,
  ) {
    return this.activityService.addActivity(user, dayPlanId, dto);
  }

  @Patch(['activity/:activityId', 'activities/:activityId'])
  @ApiOperation({ summary: 'Parent updates activity details/status' })
  @ApiBody({ type: UpdateActivityDto })
  updateActivity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('activityId') activityId: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.activityService.updateActivity(user, activityId, dto);
  }

  @Delete(['activity/:activityId', 'activities/:activityId'])
  @ApiOperation({ summary: 'Parent deletes an activity' })
  deleteActivity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('activityId') activityId: string,
  ) {
    return this.activityService.deleteActivity(user, activityId);
  }

  @Get(['activity/templates', 'activity-templates'])
  @ApiOperation({ summary: 'List reusable activity templates' })
  @ApiQuery({ name: 'category', required: false, example: 'OUTDOOR_PLAY' })
  listActivityTemplates(@Query('category') category?: string) {
    return this.activityService.listActivityTemplates(category);
  }

  @Get(['activity/templates/:templateId', 'activity-templates/:templateId'])
  @ApiOperation({ summary: 'Get activity template detail' })
  getActivityTemplate(@Param('templateId') templateId: string) {
    return this.activityService.getActivityTemplate(templateId);
  }

  @Post([
    'activity/day-plans/:dayPlanId/from-template/:templateId',
    'day-plans/:dayPlanId/activities/from-template/:templateId',
  ])
  @ApiOperation({ summary: 'Parent adds activity from a reusable template' })
  @ApiBody({ type: AddActivityFromTemplateDto })
  addActivityFromTemplate(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dayPlanId') dayPlanId: string,
    @Param('templateId') templateId: string,
    @Body() dto: AddActivityFromTemplateDto,
  ) {
    return this.activityService.addActivityFromTemplate(
      user,
      dayPlanId,
      templateId,
      dto,
    );
  }

  @Patch(['activity/nanny/:activityId/status', 'nanny/activities/:activityId/status'])
  @ApiTags('Nanny Activity')
  @ApiOperation({ summary: 'Nanny updates activity status and note' })
  @ApiBody({ type: UpdateActivityDto })
  nannyUpdateActivityStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('activityId') activityId: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.activityService.nannyUpdateActivityStatus(
      user,
      activityId,
      dto.status ?? 'COMPLETED',
      dto.nannyNote,
    );
  }

  @Post('activity/nanny/:activityId/proof-upload-url')
  @ApiTags('Nanny Activity')
  @ApiOperation({ summary: 'Create upload URL metadata for activity proof' })
  @ApiBody({ type: CreateActivityProofUploadUrlDto })
  createProofUploadUrl(
    @CurrentUser() user: CurrentUserPayload,
    @Param('activityId') activityId: string,
    @Body() dto: CreateActivityProofUploadUrlDto,
  ) {
    return this.activityService.createProofUploadUrl(
      user,
      activityId,
      dto.mimeType,
    );
  }

  @Post([
    'activity/nanny/:activityId/proof-complete',
    'nanny/activities/:activityId/proof-complete',
  ])
  @ApiTags('Nanny Activity')
  @ApiOperation({ summary: 'Nanny attaches uploaded proof image/video metadata' })
  @ApiBody({ type: CompleteProofDto })
  completeActivityProof(
    @CurrentUser() user: CurrentUserPayload,
    @Param('activityId') activityId: string,
    @Body() dto: CompleteProofDto,
  ) {
    return this.activityService.completeActivityProof(user, activityId, dto);
  }
}
