import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NannyFeedbackQueryDto } from './dto/nanny-feedback-query.dto';
import { SubmitNannyFeedbackDto } from './dto/submit-nanny-feedback.dto';
import { NannyFeedbackService } from './nannyfeedback.service';

type UploadedImageFile = {
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@ApiTags('Nanny Feedback')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('nannyfeedback')
export class NannyFeedbackController {
  constructor(private readonly nannyFeedbackService: NannyFeedbackService) {}

  @Get()
  @ApiOperation({
    summary: 'Get nanny feedback visible to parent/nanny',
    description:
      'Returns submitted nanny feedback for accessible child schedules. Parent can use childId and date to populate Today feedback cards.',
  })
  getFeedbacks(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: NannyFeedbackQueryDto,
  ) {
    return this.nannyFeedbackService.getFeedbacks(user, query);
  }

  @Get('schedules/:dayActivityId')
  @ApiOperation({
    summary: 'Get nanny feedback for one schedule/task',
    description:
      'Returns proof image, enjoyment, child mood, completion, note, and schedule metadata for one DayActivity.',
  })
  @ApiParam({
    name: 'dayActivityId',
    description: 'DayActivity ID from Today schedule/timeline.',
  })
  getScheduleFeedback(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dayActivityId') dayActivityId: string,
  ) {
    return this.nannyFeedbackService.getScheduleFeedback(user, dayActivityId);
  }

  @Post('schedules/:dayActivityId')
  @ApiOperation({
    summary: 'Submit nanny feedback for a Today schedule/task',
    description:
      'Submits task feedback and optionally uploads one image for a DayActivity schedule.',
  })
  @ApiParam({
    name: 'dayActivityId',
    description: 'DayActivity ID from the nanny Today timeline.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: SubmitNannyFeedbackDto })
  @UseInterceptors(FileInterceptor('image'))
  submitScheduleFeedback(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dayActivityId') dayActivityId: string,
    @Body() dto: SubmitNannyFeedbackDto,
    @UploadedFile() image?: UploadedImageFile,
  ) {
    return this.nannyFeedbackService.submitScheduleFeedback(
      user,
      dayActivityId,
      dto,
      image,
    );
  }

  @Patch('schedules/:dayActivityId')
  @ApiOperation({
    summary: 'Edit nanny feedback for a Today schedule/task',
    description:
      'Updates existing task feedback and optionally replaces/adds the feedback image.',
  })
  @ApiParam({
    name: 'dayActivityId',
    description: 'DayActivity ID from the nanny Today timeline.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: SubmitNannyFeedbackDto })
  @UseInterceptors(FileInterceptor('image'))
  updateScheduleFeedback(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dayActivityId') dayActivityId: string,
    @Body() dto: SubmitNannyFeedbackDto,
    @UploadedFile() image?: UploadedImageFile,
  ) {
    return this.nannyFeedbackService.updateScheduleFeedback(
      user,
      dayActivityId,
      dto,
      image,
    );
  }

  @Delete('schedules/:dayActivityId')
  @ApiOperation({
    summary: 'Delete nanny feedback for a Today schedule/task',
    description:
      'Deletes feedback and proof records for a DayActivity and resets the schedule status to planned.',
  })
  @ApiParam({
    name: 'dayActivityId',
    description: 'DayActivity ID from the nanny Today timeline.',
  })
  deleteScheduleFeedback(
    @CurrentUser() user: CurrentUserPayload,
    @Param('dayActivityId') dayActivityId: string,
  ) {
    return this.nannyFeedbackService.deleteScheduleFeedback(
      user,
      dayActivityId,
    );
  }
}
