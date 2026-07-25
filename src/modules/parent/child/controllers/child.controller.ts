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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { ChildService } from '../services/child.service';
import { AddChildDto } from '../dto/add-child.dto';
import { UpdateChildDto } from '../dto/update-child.dto';
import { ChildDailyTimelineQueryDto } from '../dto/child-daily-timeline-query.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Parent > Children')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARENT)
@Controller('parent/children')
export class ChildController {
  constructor(private readonly childService: ChildService) { }

  @Post()
  @ApiOperation({ summary: 'Add a new child for the logged-in parent' })
  @ApiResponse({ status: 201, description: 'Child added successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  addChild(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: AddChildDto,
  ) {
    return this.childService.addChild(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all children of the logged-in parent' })
  @ApiResponse({ status: 200, description: 'Children list returned successfully.' })
  getChildren(@CurrentUser() user: CurrentUserPayload) {
    return this.childService.getChildren(user.userId);
  }

  @Get(':childId')
  @ApiOperation({ summary: 'Get a specific child by ID' })
  @ApiResponse({ status: 200, description: 'Child returned successfully.' })
  @ApiResponse({ status: 404, description: 'Child not found.' })
  getChildById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
  ) {
    return this.childService.getChildById(user.userId, childId);
  }

  @Patch(':childId')
  @ApiOperation({ summary: 'Update a specific child by ID' })
  @ApiResponse({ status: 200, description: 'Child updated successfully.' })
  @ApiResponse({ status: 404, description: 'Child not found.' })
  updateChild(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
    @Body() dto: UpdateChildDto,
  ) {
    return this.childService.updateChild(user.userId, childId, dto);
  }

  @Delete(':childId')
  @ApiOperation({ summary: 'Delete a specific child by ID' })
  @ApiResponse({ status: 200, description: 'Child deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Child not found.' })
  deleteChild(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
  ) {
    return this.childService.deleteChild(user.userId, childId);
  }

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
    return this.childService.getChildDailyTimeline(user.userId, childId, query);
  }
}
