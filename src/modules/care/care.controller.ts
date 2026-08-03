import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
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
import { UpdateCareModuleDto } from './dto/update-care-module.dto';
import { SubmitCareQuizDto } from './dto/submit-care-quiz.dto';
import { ToggleCareModuleStatusDto } from './dto/toggle-care-module-status.dto';
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

  @Get('admin/modules')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get admin care modules dashboard overview (stats, module list, categories, age group, status filters)',
  })
  getAdminModules(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: CareModuleQueryDto,
  ) {
    return this.careService.getAdminModules(user, query);
  }

  @Get('admin/modules/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get admin care learning module preview/details by ID (Module content sections & Quiz questions/options)',
  })
  @ApiParam({ name: 'id', description: 'Care Module ID' })
  getAdminModuleDetail(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.careService.getAdminModuleDetail(user, id);
  }

  @Post('admin/modules')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create a care learning module with quiz and optional media files',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'coverImage', maxCount: 1 },
      { name: 'video', maxCount: 1 },
    ]),
  )
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'Blueberry Oat Porridge' },
        description: { type: 'string', example: 'Describe what nannies will learn...' },
        category: { type: 'string', enum: ['CHILD_SAFETY', 'NUTRITION_FEEDING', 'SLEEP_ROUTINES', 'CHILD_DEVELOPMENT', 'FIRST_AID', 'PLAY_LEARNING', 'COMMUNICATION', 'HEALTH_HYGIENE', 'OTHER'], example: 'NUTRITION_FEEDING' },
        ageGroup: { type: 'string', example: '1-3 years' },
        estimatedMinutes: { type: 'number', example: 15, default: 15 },
        coinReward: { type: 'number', example: 50 },
        contentTitle: { type: 'string', example: 'Write a tittle' },
        contentSections: { type: 'string', example: '{"description": "Write a description"}' },
        keyTakeaway: { type: 'string', example: 'Variability in appetite is normal' },
        adminStatus: { type: 'string', enum: ['ALL', 'PUBLISHED', 'DRAFT'], example: 'PUBLISHED' },
        isPublished: { type: 'boolean', example: true },
        questions: {
          type: 'string',
          example: '[{"question":"What is the recommended position?","type":"SINGLE_CHOICE","explanation":"On back","options":[{"label":"Back","isCorrect":true},{"label":"Stomach","isCorrect":false}]}]'
        },
        coverImage: { type: 'string', format: 'binary' },
        video: { type: 'string', format: 'binary' }
      }
    }
  })
  createModule(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateCareModuleDto,
    @UploadedFiles()
    files?: {
      coverImage?: Express.Multer.File[];
      video?: Express.Multer.File[];
    },
  ) {
    return this.careService.createModule(user, dto, files);
  }

  @Patch('admin/modules/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update a care learning module with quiz and optional media files',
  })
  @ApiParam({ name: 'id' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'coverImage', maxCount: 1 },
      { name: 'video', maxCount: 1 },
    ]),
  )
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'Blueberry Oat Porridge' },
        description: { type: 'string', example: 'Describe what nannies will learn...' },
        category: { type: 'string', enum: ['CHILD_SAFETY', 'NUTRITION_FEEDING', 'SLEEP_ROUTINES', 'CHILD_DEVELOPMENT', 'FIRST_AID', 'PLAY_LEARNING', 'COMMUNICATION', 'HEALTH_HYGIENE', 'OTHER'], example: 'NUTRITION_FEEDING' },
        ageGroup: { type: 'string', example: '1-3 years' },
        estimatedMinutes: { type: 'number', example: 15, default: 15 },
        coinReward: { type: 'number', example: 50 },
        contentTitle: { type: 'string', example: 'Write a tittle' },
        contentSections: { type: 'string', example: '{"description": "Write a description"}' },
        keyTakeaway: { type: 'string', example: 'Variability in appetite is normal' },
        adminStatus: { type: 'string', enum: ['ALL', 'PUBLISHED', 'DRAFT'], example: 'PUBLISHED' },
        isPublished: { type: 'boolean', example: true },
        questions: {
          type: 'string',
          example: '[{"question":"What is the recommended position?","type":"SINGLE_CHOICE","explanation":"On back","options":[{"label":"Back","isCorrect":true},{"label":"Stomach","isCorrect":false}]}]'
        },
        coverImage: { type: 'string', format: 'binary' },
        video: { type: 'string', format: 'binary' }
      }
    }
  })
  updateModule(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCareModuleDto,
    @UploadedFiles()
    files?: {
      coverImage?: Express.Multer.File[];
      video?: Express.Multer.File[];
    },
  ) {
    return this.careService.updateModule(user, id, dto, files);
  }

  @Patch('admin/modules/:id/status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Toggle or update care module published/draft status (Earth icon click)',
  })
  @ApiParam({ name: 'id', description: 'Care Module ID' })
  toggleModuleStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto?: ToggleCareModuleStatusDto,
  ) {
    return this.careService.toggleModuleStatus(user, id, dto);
  }

  @Delete('admin/modules/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a care learning module' })
  @ApiParam({ name: 'id' })
  deleteModule(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.careService.deleteModule(user, id);
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
