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
  ApiQuery,
  ApiResponse,
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

const careHomeResponseExample = {
  success: true,
  statusCode: 200,
  message: 'Care home fetched successfully',
  data: {
    user: {
      id: 'usr_parent_001',
      name: 'Monica Steve',
      email: 'p@e.com',
      image:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=300&auto=format&fit=crop',
      role: 'PARENT',
      greeting: 'Good Morning',
    },
    children: [
      {
        id: 'child_eve_001',
        name: 'Eve',
        image:
          'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?q=80&w=300&auto=format&fit=crop',
        avatar:
          'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?q=80&w=300&auto=format&fit=crop',
        gender: 'GIRL',
        ageYears: 5,
        isActive: true,
      },
      {
        id: 'child_rose_001',
        name: 'Rose',
        image:
          'https://images.unsplash.com/photo-1542810634-71277d95dcbb?q=80&w=300&auto=format&fit=crop',
        avatar:
          'https://images.unsplash.com/photo-1542810634-71277d95dcbb?q=80&w=300&auto=format&fit=crop',
        gender: 'GIRL',
        ageYears: 6,
        isActive: false,
      },
    ],
    caregivingHub: {
      title: 'Explore Baby handling lesson',
      subtitle: "Assign care modules to your nanny based on your child's needs.",
      selectedChildId: 'child_eve_001',
      activeTab: 'IN_PROGRESS',
      tabs: [
        { key: 'ALL', label: 'All Modules', count: 14, isActive: false },
        { key: 'IN_PROGRESS', label: 'In progress', count: 10, isActive: true },
        { key: 'COMPLETED', label: 'Completed', count: 4, isActive: false },
        { key: 'SAVED', label: 'Saved', count: 3, isActive: false },
      ],
      topics: [
        { label: 'All Topics', value: null, isActive: true },
        { label: 'Child Safety', value: 'CHILD_SAFETY', isActive: false },
        {
          label: 'Nutrition & Feeding',
          value: 'NUTRITION_FEEDING',
          isActive: false,
        },
        { label: 'Sleep & Routines', value: 'SLEEP_ROUTINES', isActive: false },
        {
          label: 'Child Development',
          value: 'CHILD_DEVELOPMENT',
          isActive: false,
        },
        { label: 'First Aid', value: 'FIRST_AID', isActive: false },
        { label: 'Play & Learning', value: 'PLAY_LEARNING', isActive: false },
        { label: 'Communication', value: 'COMMUNICATION', isActive: false },
        { label: 'Health & Hygiene', value: 'HEALTH_HYGIENE', isActive: false },
        { label: 'Other', value: 'OTHER', isActive: false },
      ],
      modules: [
        {
          id: 'care_module_behavior_001',
          title: "Handling child's behavior",
          subtitle: 'Understanding emotional regulation and response strategies',
          description:
            'Learn calm, practical ways to respond to tantrums and big feelings.',
          coverImageUrl:
            'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=1200&auto=format&fit=crop',
          videoUrl: null,
          category: 'CHILD_DEVELOPMENT',
          estimatedMinutes: 130,
          coinReward: 15,
          suggestedMinAgeYears: 2,
          suggestedMaxAgeYears: 6,
          keyTakeaway:
            'Behavior is communication. Respond to the need before correcting the action.',
          isPublished: true,
          isSaved: false,
          questionCount: 5,
          assignment: {
            id: 'assignment_behavior_001',
            moduleId: 'care_module_behavior_001',
            childId: 'child_eve_001',
            nannyUserId: 'usr_nanny_001',
            assignedByUserId: 'usr_parent_001',
            status: 'IN_PROGRESS',
            score: 60,
            totalQuestions: 5,
            correctAnswers: 3,
            pointsEarned: 0,
            pointsAwardedAt: null,
            canRetakeQuiz: true,
            quizLockedUntil: null,
            startedAt: '2026-08-08T03:00:00.000Z',
            completedAt: null,
            createdAt: '2026-08-08T02:30:00.000Z',
            updatedAt: '2026-08-08T03:10:00.000Z',
          },
          createdAt: '2026-08-08T02:00:00.000Z',
          updatedAt: '2026-08-08T02:00:00.000Z',
        },
      ],
    },
    meta: {
      total: 10,
      page: 1,
      limit: 20,
      totalPages: 1,
    },
  },
  timestamp: '2026-08-08T04:00:00.000Z',
  path: '/api/v1/care/home?tab=IN_PROGRESS',
};

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('care')
export class CareController {
  constructor(private readonly careService: CareService) {}

  @Get('admin/modules')
  @ApiTags('CareHub Admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Get modules dashboard overview with stats, list, categories, age groups, and status filters',
  })
  getAdminModules(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: CareModuleQueryDto,
  ) {
    return this.careService.getAdminModules(user, query);
  }

  @Get('admin/modules/:id')
  @ApiTags('CareHub Admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Get module preview/details by ID with lesson content and quiz questions/options',
  })
  @ApiParam({ name: 'id', description: 'Care Module ID' })
  getAdminModuleDetail(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.careService.getAdminModuleDetail(user, id);
  }

  @Post('admin/modules')
  @ApiTags('CareHub Admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Create a learning module with lesson, quiz, and optional media files',
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
  @ApiTags('CareHub Admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Update a learning module with lesson, quiz, and optional media files',
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
  @ApiTags('CareHub Admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Toggle or update module published/draft status',
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
  @ApiTags('CareHub Admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a learning module' })
  @ApiParam({ name: 'id' })
  deleteModule(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.careService.deleteModule(user, id);
  }

  @Get('home')
  @ApiTags('CareHub')
  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({
    summary:
      'Home screen: logged-in user, greeting, child list, tabs, topics, and filtered modules',
  })
  @ApiResponse({
    status: 200,
    description:
      'Care home screen payload matching the mobile Caregiving Hub design.',
    schema: {
      example: careHomeResponseExample,
    },
  })
  getCareHome(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: CareModuleQueryDto,
  ) {
    return this.careService.getCareHome(user, query);
  }

  @Get('children/:childId/suggested-modules')
  @ApiTags('CareHub')
  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({
    summary:
      'Get suggested modules for a child by age and module suggested year range',
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
  @ApiTags('CareHub Insights')
  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({
    summary:
      'Get favorite activities, favorite meals, and meta counts for a child',
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
  @ApiTags('CareHub Insights')
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
  @ApiTags('CareHub Insights')
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
  @ApiTags('CareHub Insights')
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
  @ApiTags('CareHub Insights')
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

  @Get('modules/:moduleId')
  @ApiTags('CareHub')
  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({
    summary: 'Get module lesson and quiz questions',
    description:
      'Use this after selecting a module from /api/v1/care/home or suggested-modules. assignmentId is optional and only needed when the caller wants assignment progress/result context.',
  })
  @ApiParam({ name: 'moduleId' })
  @ApiQuery({
    name: 'assignmentId',
    required: false,
    description:
      'Optional. Pass only when you want this module detail with a specific child/nanny assignment progress.',
  })
  getModuleDetail(
    @CurrentUser() user: CurrentUserPayload,
    @Param('moduleId') moduleId: string,
    @Query('assignmentId') assignmentId?: string,
  ) {
    return this.careService.getModuleDetail(user, moduleId, assignmentId);
  }

  @Post('assignments')
  @ApiTags('CareHub')
  @Roles(UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({
    summary: 'Assign a module to a nanny for a child',
  })
  @ApiBody({ type: AssignCareModuleDto })
  assignModule(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: AssignCareModuleDto,
  ) {
    return this.careService.assignModule(user, dto);
  }

  @Post('modules/:moduleId/save')
  @ApiTags('CareHub')
  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Save a module to the Saved tab' })
  @ApiParam({ name: 'moduleId' })
  saveModule(
    @CurrentUser() user: CurrentUserPayload,
    @Param('moduleId') moduleId: string,
  ) {
    return this.careService.saveModule(user, moduleId);
  }

  @Delete('modules/:moduleId/save')
  @ApiTags('CareHub')
  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Remove a module from the Saved tab' })
  @ApiParam({ name: 'moduleId' })
  removeSavedModule(
    @CurrentUser() user: CurrentUserPayload,
    @Param('moduleId') moduleId: string,
  ) {
    return this.careService.removeSavedModule(user, moduleId);
  }

  @Post('assignments/:assignmentId/quiz')
  @ApiTags('CareHub Quiz')
  @Roles(UserRole.NANNY)
  @ApiOperation({
    summary: 'Submit quiz answers and get result review',
  })
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
  @ApiTags('CareHub Quiz')
  @Roles(UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({
    summary: 'Get completed quiz result review',
  })
  @ApiParam({ name: 'assignmentId' })
  getQuizResult(
    @CurrentUser() user: CurrentUserPayload,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.careService.getQuizResult(user, assignmentId);
  }
}
