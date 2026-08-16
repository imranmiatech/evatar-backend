import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';

import { CareModuleQueryDto } from '../dto/care-module-query.dto';
import { CarehubService } from '../services/carehub.service';



@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('(Parent/Nanny) > Care Hub')
@Controller('care')
export class CarehubController {
  constructor(private readonly careService: CarehubService) {}



  @Get('modules')
  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Get all published care modules (All Modules tab)' })
  getModules(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: CareModuleQueryDto,
  ) {
    return this.careService.getModules(user, query);
  }

  @Get('home/topics')
  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Get Care Hub topic filters' })
  getCareHomeTopics() {
    return this.careService.getCareHomeTopics();
  }

  @Get('children')
  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Get child list for Caregiving Hub' })
  getCareChildren(@CurrentUser() user: CurrentUserPayload) {
    return this.careService.getMyCareChildren(user);
  }

  @Get('children/:childId/suggested-modules')
  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Get suggested modules for a child (Suggested for [Child] tab)' })
  @ApiParam({ name: 'childId' })
  getSuggestedModules(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
    @Query() query: CareModuleQueryDto,
  ) {
    return this.careService.getSuggestedModules(user, childId, query);
  }

  @Get('module-progress')
  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Get In Progress or Completed modules for the user' })
  @ApiQuery({ name: 'tab', enum: ['IN_PROGRESS', 'COMPLETED'], required: true })
  getModuleProgress(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: CareModuleQueryDto,
  ) {
    return this.careService.getModuleProgress(user, query);
  }

  @Get('modules/:moduleId')
  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Get module lesson and quiz questions' })
  @ApiParam({ name: 'moduleId' })
  getModuleDetail(
    @CurrentUser() user: CurrentUserPayload,
    @Param('moduleId') moduleId: string,
  ) {
    return this.careService.getModuleDetail(user, moduleId);
  }

  @Post('modules/:moduleId/save')
  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Save a module to the user Saved tab' })
  @ApiParam({ name: 'moduleId' })
  saveModule(
    @CurrentUser() user: CurrentUserPayload,
    @Param('moduleId') moduleId: string,
  ) {
    return this.careService.saveModule(user, moduleId);
  }

  @Delete('modules/:moduleId/save')
  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({ summary: 'Remove a module from the user Saved tab' })
  @ApiParam({ name: 'moduleId' })
  removeSavedModule(
    @CurrentUser() user: CurrentUserPayload,
    @Param('moduleId') moduleId: string,
  ) {
    return this.careService.removeSavedModule(user, moduleId);
  }
}
