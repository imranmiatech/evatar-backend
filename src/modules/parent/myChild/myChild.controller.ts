import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { MyChildService } from './myChild.service';

@ApiTags('My Children')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('my-children')
export class MyChildController {
  constructor(private readonly myChildService: MyChildService) {}

  @Get()
  @ApiOperation({
    summary:
      'Get logged-in user children with avatar, age, and assigned nanny info',
  })
  listMyChildren(@CurrentUser() user: CurrentUserPayload) {
    return this.myChildService.listMyChildren(user);
  }

  @Get(':childId')
  @ApiOperation({
    summary: 'Get child profile header, caregivers, and tab counters',
  })
  getChildProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
  ) {
    return this.myChildService.getChildProfile(user, childId);
  }

  @Get(':childId/memories')
  @ApiOperation({
    summary: 'Get child memory gallery items for the profile memories tab',
  })
  getChildMemories(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
  ) {
    return this.myChildService.getChildMemories(user, childId);
  }

  @Delete(':childId/memories/:memoryId')
  @ApiOperation({
    summary: 'Delete a child memory image from the profile gallery',
  })
  deleteChildMemory(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
    @Param('memoryId') memoryId: string,
  ) {
    return this.myChildService.deleteChildMemory(user, childId, memoryId);
  }

  @Get(':childId/bedtime-stories')
  @ApiOperation({
    summary: 'Get child bedtime story cards for the profile stories tab',
  })
  getChildBedtimeStories(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
  ) {
    return this.myChildService.getChildBedtimeStories(user, childId);
  }

  @Get(':childId/personality')
  @ApiOperation({
    summary: 'Get child preferences and personality snapshot',
  })
  getChildPersonality(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
  ) {
    return this.myChildService.getChildPersonality(user, childId);
  }
}
