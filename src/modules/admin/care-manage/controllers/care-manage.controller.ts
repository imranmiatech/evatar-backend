import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, type CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { CreateCareModuleDto } from '../dto/create-care-module.dto';
import { UpdateCareModuleDto } from '../dto/update-care-module.dto';
import { ToggleCareModuleStatusDto } from '../dto/toggle-care-module-status.dto';
import { AdminCareModuleQueryDto } from '../dto/admin-care-module-query.dto';
import { CareManageService } from '../services/care-manage.service';

@ApiTags('(Admin) > Care Modules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/care-modules')
export class CareManageController {
  constructor(private readonly careManageService: CareManageService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get modules dashboard overview with stats, list, categories, age groups, and status filters',
  })
  getAdminModules(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: AdminCareModuleQueryDto,
  ) {
    return this.careManageService.getAdminModules(user, query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get module preview/details by ID with lesson content and quiz questions/options',
  })
  @ApiParam({ name: 'id', description: 'Care Module ID' })
  getAdminModuleDetail(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.careManageService.getAdminModuleDetail(user, id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create a learning module with lesson, quiz, and optional media files',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'coverImage', maxCount: 1 },
      { name: 'video', maxCount: 1 },
    ]),
  )
  createModule(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateCareModuleDto,
    @UploadedFiles()
    files?: {
      coverImage?: Express.Multer.File[];
      video?: Express.Multer.File[];
    },
  ) {
    return this.careManageService.createModule(user, dto, files);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update a learning module with lesson, quiz, and optional media files',
  })
  @ApiParam({ name: 'id' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'coverImage', maxCount: 1 },
      { name: 'video', maxCount: 1 },
    ]),
  )
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
    return this.careManageService.updateModule(user, id, dto, files);
  }

  @Patch(':id/status')
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
    return this.careManageService.toggleModuleStatus(user, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a learning module' })
  @ApiParam({ name: 'id' })
  deleteModule(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.careManageService.deleteModule(user, id);
  }
}
