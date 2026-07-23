import { Controller, Get, Body, Patch, Param, Delete, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { StorageService } from '../../common/storage/storage.service';
import {
  UpdateParentProfileDto,
  UpdateUserDto,
} from './dto/update-user.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UserService } from './user.service';

@ApiTags('User')
@ApiBearerAuth()
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly storageService: StorageService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current logged-in user profile' })
  @ApiResponse({ status: 200, description: 'Return the current user profile.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getProfile(@CurrentUser() user: any) {
    return this.userService.getUserById(user.id);
  }

  @Get('me/document')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current logged-in user documents (NID/Passport)' })
  @ApiResponse({ status: 200, description: 'Return the current user documents.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getDocuments(@CurrentUser() user: any) {
    return this.userService.getUserDocuments(user.id);
  }

  @Get('nannies-documents')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get documents of all nannies assigned to the logged-in parent\'s children' })
  @ApiResponse({ status: 200, description: 'Return grouped documents of assigned nannies.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getAssignedNanniesDocuments(@CurrentUser() user: any) {
    return this.userService.getAssignedNanniesDocuments(user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('profilePicture'))
  async updateMe(
    @CurrentUser() user: any,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    if (file) {
      const url = await this.storageService.uploadFile(file, 'profiles');
      updateUserDto.profilePictureUrl = url;
    }
    return this.userService.updateUser(user.id, updateUserDto);
  }

  @Patch('me/parent-profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update current parent address/profile details' })
  updateMyParentProfile(
    @CurrentUser() user: any,
    @Body() dto: UpdateParentProfileDto,
  ) {
    return this.userService.updateMyParentProfile(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiResponse({ status: 200, description: 'Return the user profile.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  findOne(@Param('id') id: string) {
    return this.userService.getUserById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user profile' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('profilePicture'))
  @ApiResponse({ status: 200, description: 'The user has been successfully updated.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async update(
    @Param('id') id: string, 
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    if (file) {
      const url = await this.storageService.uploadFile(file, 'profiles');
      updateUserDto.profilePictureUrl = url;
    }
    return this.userService.updateUser(id, updateUserDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 200, description: 'The user has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  remove(@Param('id') id: string) {
    return this.userService.deleteUser(id);
  }
}
