import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';

import { CareChildInsightsQueryDto } from '../dto/care-child-insights-query.dto';
import { CreateCareChildNoteDto } from '../dto/create-care-child-note.dto';
import { CareMonthlyHighlightsQueryDto } from '../dto/care-monthly-highlights-query.dto';
import { CarehubInsightsService } from '../services/carehub-insights.service';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('(Parent/Nanny) > Care Hub Insights')
@Controller('care')
export class CarehubInsightsController {
  constructor(private readonly careService: CarehubInsightsService) { }

  @Get('children/:childId/insights')
  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({
    summary: 'Get favorite activities, favorite meals, and meta counts for a child',
  })
  @ApiParam({ name: 'childId' })
  getChildInsights(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
    @Query() query: CareChildInsightsQueryDto,
  ) {
    return this.careService.getChildInsights(user, childId, query);
  }

  @Get('children/:childId/monthly-highlights')
  @Roles(UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({
    summary: 'Get monthly highlight proof images from activities the child enjoyed',
  })
  @ApiParam({ name: 'childId' })
  getMonthlyHighlights(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
    @Query() query: CareMonthlyHighlightsQueryDto,
  ) {
    return this.careService.getMonthlyHighlights(user, childId, query);
  }

  @Get('children/:childId/notes')
  @Roles(UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({
    summary: 'Get child care notes and preferences',
  })
  @ApiParam({ name: 'childId' })
  getChildNotes(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
  ) {
    return this.careService.getChildNotes(user, childId);
  }

  @Post('children/:childId/notes')
  @Roles(UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({
    summary: 'Add a child care note or preference',
  })
  @ApiParam({ name: 'childId' })
  @ApiBody({ type: CreateCareChildNoteDto })
  createChildNote(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
    @Body() dto: CreateCareChildNoteDto,
  ) {
    return this.careService.createChildNote(user, childId, dto);
  }

  @Delete('children/:childId/notes/:noteId')
  @Roles(UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({
    summary: 'Delete a child care note or preference',
  })
  @ApiParam({ name: 'childId' })
  @ApiParam({ name: 'noteId' })
  deleteChildNote(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.careService.deleteChildNote(user, childId, noteId);
  }
}
