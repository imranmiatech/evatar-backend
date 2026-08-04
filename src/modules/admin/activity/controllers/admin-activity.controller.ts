import { Controller, Post, Body, Patch, Param, Get, Query, Delete, UseGuards, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { AdminActivityService } from '../services/admin-activity.service';
import { CreateActivityDto } from '../dto/create-activity.dto';
import { UpdateActivityDto } from '../dto/update-activity.dto';
import { AdminActivityQueryDto } from '../dto/activity-query.dto';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('(Admin) > Activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/activities')
export class AdminActivityController {
  constructor(private readonly adminActivityService: AdminActivityService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new Activity' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'coverImage', maxCount: 1 },
      { name: 'video', maxCount: 1 },
    ]),
  )
  @ApiResponse({ status: 201, description: 'Activity created successfully.' })
  async createActivity(
    @Body() createActivityDto: CreateActivityDto,
    @UploadedFiles()
    files?: {
      coverImage?: Express.Multer.File[];
      video?: Express.Multer.File[];
    },
  ) {
    const activity = await this.adminActivityService.createActivity(createActivityDto, files);
    return {
      success: true,
      message: 'Activity created successfully',
      data: activity,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all Activities (Paginated & Filtered)' })
  @ApiResponse({ status: 200, description: 'Activities fetched successfully.' })
  async getAllActivities(@Query() query: AdminActivityQueryDto) {
    const result = await this.adminActivityService.getAllActivities(query);
    return {
      success: true,
      message: 'Activities fetched successfully',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single Activity by ID' })
  @ApiResponse({ status: 200, description: 'Activity fetched successfully.' })
  async getActivityById(@Param('id') id: string) {
    const activity = await this.adminActivityService.getActivityById(id);
    return {
      success: true,
      message: 'Activity fetched successfully',
      data: activity,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing Activity' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'coverImage', maxCount: 1 },
      { name: 'video', maxCount: 1 },
    ]),
  )
  @ApiResponse({ status: 200, description: 'Activity updated successfully.' })
  async updateActivity(
    @Param('id') id: string,
    @Body() updateActivityDto: UpdateActivityDto,
    @UploadedFiles()
    files?: {
      coverImage?: Express.Multer.File[];
      video?: Express.Multer.File[];
    },
  ) {
    const activity = await this.adminActivityService.updateActivity(id, updateActivityDto, files);
    return {
      success: true,
      message: 'Activity updated successfully',
      data: activity,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an Activity' })
  @ApiResponse({ status: 200, description: 'Activity deleted successfully.' })
  async deleteActivity(@Param('id') id: string) {
    await this.adminActivityService.deleteActivity(id);
    return {
      success: true,
      message: 'Activity deleted successfully',
      data: null,
    };
  }
}
