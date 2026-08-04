import { Controller, Get, Patch, Delete, Query, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminUsersService } from './admin-users.service';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('Admin User Management')
@ApiBearerAuth()
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get overview metric cards (Total, Active Today, New, Trial, Paid, Suspended) & Per Enum Counts' })
  @ApiResponse({ status: 200, description: 'Return metrics and enum counts.' })
  async getUserStats() {
    return this.adminUsersService.getUserStats();
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get user list with search, role, status, and plan filters' })
  @ApiResponse({ status: 200, description: 'Return user list with pagination meta.' })
  async getUsers(@Query() query: AdminUserQueryDto) {
    return this.adminUsersService.getUsers(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get details of a single user' })
  @ApiResponse({ status: 200, description: 'Return user details.' })
  async getUserById(@Param('id') id: string) {
    return this.adminUsersService.getUserById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Edit user profile, role, status, or plan' })
  @ApiResponse({ status: 200, description: 'User updated successfully.' })
  async updateUser(@Param('id') id: string, @Body() dto: UpdateAdminUserDto) {
    return this.adminUsersService.updateUser(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 200, description: 'User deleted successfully.' })
  async deleteUser(@Param('id') id: string) {
    return this.adminUsersService.deleteUser(id);
  }
}
