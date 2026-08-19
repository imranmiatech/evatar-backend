import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ChildService } from './child.service';

@ApiTags('Manage System / Children')
@Controller('manage-system')
export class ChildController {
  constructor(private readonly childService: ChildService) {}

  @Get('children')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Screen 2: Get child picker list for account owner',
    description:
      'Returns list of children owned by or accessible to the account owner with image, name, birthDate, and formatted age.',
  })
  getMyChildren(@CurrentUser() user: CurrentUserPayload) {
    return this.childService.getMyChildren(user.userId);
  }
}
