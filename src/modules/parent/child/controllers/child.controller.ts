import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { StorageService } from '../../../../common/storage/storage.service';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { ChildService } from '../services/child.service';
import { AddChildDto } from '../dto/add-child.dto';
import { UpdateChildDto } from '../dto/update-child.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('(Parent) > Children Manage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('parent/children')
export class ChildController {
  constructor(
    private readonly childService: ChildService,
    private readonly storageService: StorageService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Add a new child for the logged-in parent' })
  @ApiResponse({ status: 201, description: 'Child added successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.PARENT)
  addChild(@CurrentUser() user: CurrentUserPayload, @Body() dto: AddChildDto) {
    return this.childService.addChild(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all children of the logged-in parent' })
  @ApiResponse({
    status: 200,
    description: 'Children list returned successfully.',
  })
  getChildren(@CurrentUser() user: CurrentUserPayload) {
    return this.childService.getChildren(user.userId);
  }

  @Get(':childId/profile')
  @ApiOperation({ summary: 'Get a complete child profile dashboard' })
  @ApiResponse({
    status: 200,
    description: 'Child profile returned successfully.',
  })
  @ApiResponse({ status: 404, description: 'Child not found.' })
  getChildProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
  ) {
    return this.childService.getChildProfile(user.userId, childId);
  }

  @Delete(':childId/memories/:memoryId')
  @ApiOperation({ summary: 'Delete a child profile memory/photo' })
  @ApiResponse({
    status: 200,
    description: 'Memory photo deleted successfully.',
  })
  @ApiResponse({ status: 404, description: 'Memory photo not found.' })
  deleteChildMemory(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
    @Param('memoryId') memoryId: string,
  ) {
    return this.childService.deleteChildMemory(user.userId, childId, memoryId);
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
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateChildDto })
  @UseInterceptors(FileInterceptor('profilePicture'))
  @ApiResponse({ status: 200, description: 'Child updated successfully.' })
  @ApiResponse({ status: 404, description: 'Child not found.' })
  async updateChild(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
    @Body() dto: UpdateChildDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    this.normalizeMultipartDto(dto);

    if (file) {
      dto.avatar = await this.storageService.uploadFile(file, 'children');
    }

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

  private normalizeMultipartDto(dto: UpdateChildDto) {
    if (typeof dto.hasAllergy === 'string') {
      dto.hasAllergy = dto.hasAllergy === 'true';
    }

    if (typeof dto.healthConditions === 'string') {
      dto.healthConditions = this.parseJsonField(dto.healthConditions);
    }

    if (typeof dto.schoolSchedule === 'string') {
      dto.schoolSchedule = this.parseJsonField(dto.schoolSchedule);
    }

    if (typeof dto.naps === 'string') {
      dto.naps = this.parseJsonField(dto.naps);
    }
  }

  private parseJsonField(value: string) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
