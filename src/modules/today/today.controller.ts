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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUserPayload } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import {
  CompleteAiResultDto,
  CompleteRecordingDto,
  CreateChildDto,
  CreateGuidedDayPlanDto,
  CreateManualDayPlanDto,
  CreateNannyLinkDto,
  CreateRecordingUploadUrlDto,
  RequestAiGenerationDto,
  UpdateGuidedAnswersDto,
  UpdateBedtimeStoryDto,
  UpdateChildDto,
} from './dto';
import { CreateBedtimeStoryDto } from './dto/story-recording.dto';
import { todayService } from './today.service';

@ApiTags('Today')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('today')
export class todayController {
  constructor(private readonly todayService: todayService) {}

  @Post('children')
  @ApiOperation({ summary: 'Create child profile for Today setup' })
  createChild(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateChildDto,
  ) {
    return this.todayService.createChild(user, dto);
  }

  @Get('children')
  @ApiOperation({ summary: 'List parent children or assigned nanny children' })
  listChildren(@CurrentUser() user: CurrentUserPayload) {
    return this.todayService.listChildren(user);
  }

  @Get('children/:childId')
  @ApiOperation({ summary: 'Get child profile' })
  getChild(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
  ) {
    return this.todayService.getChild(user, childId);
  }

  @Patch('children/:childId')
  @ApiOperation({ summary: 'Update child profile' })
  updateChild(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
    @Body() dto: UpdateChildDto,
  ) {
    return this.todayService.updateChild(user, childId, dto);
  }

  @Delete('children/:childId')
  @ApiOperation({ summary: 'Delete child profile' })
  deleteChild(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
  ) {
    return this.todayService.deleteChild(user, childId);
  }

  @Post('children/:childId/nanny-links')
  @ApiOperation({ summary: 'Assign a nanny to a child' })
  createNannyLink(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
    @Body() dto: CreateNannyLinkDto,
  ) {
    return this.todayService.createNannyLink(user, childId, dto);
  }

  @Get('children/:childId/nanny-links')
  @ApiOperation({ summary: 'List nannies assigned to a child' })
  listNannyLinks(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
  ) {
    return this.todayService.listNannyLinks(user, childId);
  }

  @Delete('children/:childId/nanny-links/:nannyUserId')
  @ApiOperation({ summary: 'Remove a nanny from a child' })
  removeNannyLink(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
    @Param('nannyUserId') nannyUserId: string,
  ) {
    return this.todayService.removeNannyLink(user, childId, nannyUserId);
  }

  @Get('nannies/search')
  @ApiOperation({ summary: 'Search approved nannies for parent invite modal' })
  searchNannies(
    @CurrentUser() user: CurrentUserPayload,
    @Query('query') query?: string,
  ) {
    return this.todayService.searchNannies(user, query);
  }

  @Post('children/:childId/day-plans/guided-draft')
  @ApiOperation({ summary: 'Start guided setup draft' })
  createGuidedDraft(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
    @Body() dto: CreateGuidedDayPlanDto,
  ) {
    return this.todayService.createGuidedDraft(user, childId, dto);
  }

  @Post('children/:childId/day-plans/manual')
  @ApiOperation({ summary: 'Start manual build flow' })
  createManualPlan(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
    @Body() dto: CreateManualDayPlanDto,
  ) {
    return this.todayService.createManualPlan(user, childId, dto);
  }

  @Get('children/:childId/day-plans')
  @ApiOperation({ summary: 'List child day plans' })
  getChildDayPlans(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
  ) {
    return this.todayService.getChildDayPlans(user, childId);
  }

  @Get('day-plans/:dayPlanId')
  @ApiOperation({ summary: 'Get day plan with activities and bedtime story' })
  getDayPlan(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dayPlanId') dayPlanId: string,
  ) {
    return this.todayService.getDayPlan(user, dayPlanId);
  }

  @Patch('day-plans/:dayPlanId/guided-answers')
  @ApiOperation({ summary: 'Update guided setup answers' })
  updateGuidedAnswers(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dayPlanId') dayPlanId: string,
    @Body() dto: UpdateGuidedAnswersDto,
  ) {
    return this.todayService.updateGuidedAnswers(
      user,
      dayPlanId,
      dto.guidedAnswers,
    );
  }

  @Post('day-plans/:dayPlanId/generate')
  @ApiOperation({ summary: 'Prepare guided setup for ready plan build' })
  requestAiGeneration(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dayPlanId') dayPlanId: string,
    @Body() dto: RequestAiGenerationDto,
  ) {
    return this.todayService.requestAiGeneration(user, dayPlanId, dto);
  }

  @Post('day-plans/:dayPlanId/ai-result')
  @ApiOperation({
    summary: 'Save ready day activities and bedtime story',
  })
  completeAiResult(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dayPlanId') dayPlanId: string,
    @Body() dto: CompleteAiResultDto,
  ) {
    return this.todayService.completeAiResult(user, dayPlanId, dto);
  }

  @Post('day-plans/:dayPlanId/ready')
  @ApiOperation({ summary: 'Mark manual day plan ready' })
  markDayPlanReady(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dayPlanId') dayPlanId: string,
  ) {
    return this.todayService.markDayPlanReady(user, dayPlanId);
  }

  @Get('children/:childId/bedtime-stories')
  @ApiOperation({ summary: 'List bedtime stories for a child' })
  listBedtimeStories(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
  ) {
    return this.todayService.listBedtimeStories(user, childId);
  }

  @Get('day-plans/:dayPlanId/bedtime-story')
  @ApiOperation({ summary: 'Get bedtime story for a day plan' })
  getBedtimeStory(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dayPlanId') dayPlanId: string,
  ) {
    return this.todayService.getBedtimeStory(user, dayPlanId);
  }

  @Post('day-plans/:dayPlanId/bedtime-story')
  @ApiOperation({ summary: 'Create or replace manual bedtime story for a day plan' })
  createManualBedtimeStory(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dayPlanId') dayPlanId: string,
    @Body() dto: CreateBedtimeStoryDto,
  ) {
    return this.todayService.createManualBedtimeStory(user, dayPlanId, dto);
  }

  @Patch('bedtime-stories/:storyId')
  @ApiOperation({ summary: 'Parent edits bedtime story text/details' })
  updateBedtimeStory(
    @CurrentUser() user: CurrentUserPayload,
    @Param('storyId') storyId: string,
    @Body() dto: UpdateBedtimeStoryDto,
  ) {
    return this.todayService.updateBedtimeStory(user, storyId, dto);
  }

  @Post('bedtime-stories/:storyId/recording-upload-url')
  @ApiOperation({
    summary: 'Create storage key/upload URL for parent recording',
  })
  createRecordingUploadUrl(
    @CurrentUser() user: CurrentUserPayload,
    @Param('storyId') storyId: string,
    @Body() dto: CreateRecordingUploadUrlDto,
  ) {
    return this.todayService.createRecordingUploadUrl(
      user,
      storyId,
      dto.mimeType,
    );
  }

  @Post('bedtime-stories/:storyId/recording-complete')
  @ApiOperation({ summary: 'Attach uploaded parent audio recording to story' })
  completeRecording(
    @CurrentUser() user: CurrentUserPayload,
    @Param('storyId') storyId: string,
    @Body() dto: CompleteRecordingDto,
  ) {
    return this.todayService.completeRecording(user, storyId, dto);
  }

  @Get('nanny/children')
  @ApiOperation({ summary: 'Nanny lists assigned children' })
  listNannyChildren(@CurrentUser() user: CurrentUserPayload) {
    return this.todayService.listNannyChildren(user);
  }

  @Get('nanny-profiles/:nannyUserId')
  @ApiOperation({ summary: 'Get nanny public profile details' })
  getNannyProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Param('nannyUserId') nannyUserId: string,
  ) {
    return this.todayService.getNannyProfile(user, nannyUserId);
  }

  @Get('nanny/children/:childId/today')
  @ApiOperation({ summary: "Nanny gets assigned child's today plan" })
  getNannyToday(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
  ) {
    return this.todayService.getNannyToday(user, childId);
  }

  @Get('nanny/bedtime-stories/:storyId/playback')
  @ApiOperation({ summary: 'Nanny reads story and plays parent recording' })
  getNannyStoryPlayback(
    @CurrentUser() user: CurrentUserPayload,
    @Param('storyId') storyId: string,
  ) {
    return this.todayService.getNannyStoryPlayback(user, storyId);
  }
}
