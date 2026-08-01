import {
  Body,
  Controller,
  Delete,
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
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AssignCareModuleDto } from './dto/assign-care-module.dto';
import { CareModuleQueryDto } from './dto/care-module-query.dto';
import { CreateCareModuleDto } from './dto/create-care-module.dto';
import { SubmitCareQuizDto } from './dto/submit-care-quiz.dto';
import { CareService } from './care.service';
import { CareChildInsightsQueryDto } from './dto/care-child-insights-query.dto';
import { CreateCareChildNoteDto } from './dto/create-care-child-note.dto';
import { CareMonthlyHighlightsQueryDto } from './dto/care-monthly-highlights-query.dto';

@ApiTags('Care')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('care')
export class CareController {
  constructor(private readonly careService: CareService) {}

  @Post('admin/modules')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a care learning module with quiz' })
  @ApiBody({ type: CreateCareModuleDto })
  createModule(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateCareModuleDto,
  ) {
    return this.careService.createModule(user, dto);
  }

  @Get('modules')
  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({
    summary:
      'Get care modules by tab/category. Tabs: ALL, IN_PROGRESS, COMPLETED, SAVED.',
  })
  getModules(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: CareModuleQueryDto,
  ) {
    return this.careService.getModules(user, query);
  }

  @Get('children')
  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Get care-accessible children for logged-in user' })
  getMyCareChildren(@CurrentUser() user: CurrentUserPayload) {
    return this.careService.getMyCareChildren(user);
  }

  @Get('children/:childId/suggested-modules')
  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({
    summary:
      'Get suggested care modules for a child by child age and module suggested year range',
  })
  @ApiParam({ name: 'childId' })
  getSuggestedModules(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
    @Query() query: CareModuleQueryDto,
  ) {
    return this.careService.getSuggestedModules(user, childId, query);
  }

  @Get('children/:childId/insights')
  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({
    summary:
      'Get child care insights: favorite activities, favorite meals, and meta counts',
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
    summary:
      'Get monthly highlight proof images from activities the child enjoyed',
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
  @ApiOperation({ summary: 'Get child care notes and preferences' })
  @ApiParam({ name: 'childId' })
  getChildNotes(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
  ) {
    return this.careService.getChildNotes(user, childId);
  }

  @Post('children/:childId/notes')
  @Roles(UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Add a child care note or preference' })
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
  @ApiOperation({ summary: 'Delete a child care note or preference' })
  @ApiParam({ name: 'childId' })
  @ApiParam({ name: 'noteId' })
  deleteChildNote(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.careService.deleteChildNote(user, childId, noteId);
  }

  @Get('modules/:moduleId')
  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Get care module lesson and quiz questions' })
  @ApiParam({ name: 'moduleId' })
  getModuleDetail(
    @CurrentUser() user: CurrentUserPayload,
    @Param('moduleId') moduleId: string,
    @Query('assignmentId') assignmentId?: string,
  ) {
    return this.careService.getModuleDetail(user, moduleId, assignmentId);
  }

  @Post('assignments')
  @Roles(UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Assign a care module to a nanny for a child' })
  @ApiBody({ type: AssignCareModuleDto })
  assignModule(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: AssignCareModuleDto,
  ) {
    return this.careService.assignModule(user, dto);
  }

  @Post('modules/:moduleId/save')
  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Save a care module to the Save tab' })
  @ApiParam({ name: 'moduleId' })
  saveModule(
    @CurrentUser() user: CurrentUserPayload,
    @Param('moduleId') moduleId: string,
  ) {
    return this.careService.saveModule(user, moduleId);
  }

  @Delete('modules/:moduleId/save')
  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Remove a care module from the Save tab' })
  @ApiParam({ name: 'moduleId' })
  removeSavedModule(
    @CurrentUser() user: CurrentUserPayload,
    @Param('moduleId') moduleId: string,
  ) {
    return this.careService.removeSavedModule(user, moduleId);
  }

  @Post('assignments/:assignmentId/quiz')
  @Roles(UserRole.NANNY)
  @ApiOperation({ summary: 'Submit care quiz answers and get result review' })
  @ApiParam({ name: 'assignmentId' })
  @ApiBody({ type: SubmitCareQuizDto })
  submitQuiz(
    @CurrentUser() user: CurrentUserPayload,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: SubmitCareQuizDto,
  ) {
    return this.careService.submitQuiz(user, assignmentId, dto);
  }

  @Get('assignments/:assignmentId/result')
  @Roles(UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Get completed care quiz result review' })
  @ApiParam({ name: 'assignmentId' })
  getQuizResult(
    @CurrentUser() user: CurrentUserPayload,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.careService.getQuizResult(user, assignmentId);
  }
}
