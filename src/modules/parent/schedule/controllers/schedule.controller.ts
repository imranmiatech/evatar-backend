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
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { ScheduleService } from '../services/schedule.service';
import { CreateLibraryScheduleDto } from '../dto/create-library-schedule.dto';
import { CreateManualScheduleDto } from '../dto/create-manual-schedule.dto';
import { ScheduleQueryDto } from '../dto/schedule-query.dto';
import { UpdateLibraryScheduleDto } from '../dto/update-library-schedule.dto';
import { UpdateManualScheduleDto } from '../dto/update-manual-schedule.dto';

@ApiTags('(Parent) > Schedule Manage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('parent/schedules')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) { }

  @Post('library')
  @ApiOperation({
    summary: 'Add a schedule from library (Activity or Recipe)',
    description:
      'Creates a schedule using an existing library item. Date defaults to today if not provided.',
  })
  @ApiResponse({ status: 201, description: 'Schedule created from library.' })
  createFromLibrary(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateLibraryScheduleDto,
  ) {
    return this.scheduleService.createFromLibrary(user.userId, dto);
  }

  @Post('manual')
  @ApiOperation({
    summary: 'Add a manual (custom) schedule',
    description:
      'Creates a custom schedule with a user-provided title and category. Date defaults to today if not provided.',
  })
  @ApiResponse({ status: 201, description: 'Manual schedule created.' })
  createManual(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateManualScheduleDto,
  ) {
    return this.scheduleService.createManual(user.userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: "Get today's and other schedules",
    description:
      "Returns today's schedules and other (upcoming/past) schedules separately. Optionally filter by childId.",
  })
  @ApiResponse({ status: 200, description: 'Schedules returned.' })
  getSchedules(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ScheduleQueryDto,
  ) {
    return this.scheduleService.getSchedules(user.userId, query);
  }

  @Get(':scheduleId')
  @ApiOperation({ summary: 'Get a single schedule item' })
  @ApiParam({ name: 'scheduleId', description: 'Schedule ID' })
  @ApiResponse({ status: 200, description: 'Schedule fetched successfully.' })
  @ApiResponse({ status: 404, description: 'Schedule not found.' })
  getScheduleById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('scheduleId') scheduleId: string,
  ) {
    return this.scheduleService.getScheduleById(user.userId, scheduleId);
  }

  @Patch('library/:scheduleId')
  @ApiOperation({ summary: 'Update a schedule from library (Activity or Recipe)' })
  @ApiParam({ name: 'scheduleId', description: 'Schedule ID' })
  @ApiResponse({ status: 200, description: 'Library schedule updated.' })
  @ApiResponse({ status: 404, description: 'Schedule not found.' })
  updateLibrarySchedule(
    @CurrentUser() user: CurrentUserPayload,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: UpdateLibraryScheduleDto,
  ) {
    return this.scheduleService.updateLibrarySchedule(user.userId, scheduleId, dto);
  }

  @Patch('manual/:scheduleId')
  @ApiOperation({ summary: 'Update a manual (custom) schedule' })
  @ApiParam({ name: 'scheduleId', description: 'Schedule ID' })
  @ApiResponse({ status: 200, description: 'Manual schedule updated.' })
  @ApiResponse({ status: 404, description: 'Schedule not found.' })
  updateManualSchedule(
    @CurrentUser() user: CurrentUserPayload,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: UpdateManualScheduleDto,
  ) {
    return this.scheduleService.updateManualSchedule(user.userId, scheduleId, dto);
  }

  @Delete(':scheduleId')
  @ApiOperation({ summary: 'Delete a schedule item' })
  @ApiParam({ name: 'scheduleId', description: 'Schedule ID' })
  @ApiResponse({ status: 200, description: 'Schedule deleted.' })
  @ApiResponse({ status: 404, description: 'Schedule not found.' })
  deleteSchedule(
    @CurrentUser() user: CurrentUserPayload,
    @Param('scheduleId') scheduleId: string,
  ) {
    return this.scheduleService.deleteSchedule(user.userId, scheduleId);
  }
}
