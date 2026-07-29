import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
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
import { ProfileNannyPortfolioQueryDto } from './dto/profile-nanny-portfolio-query.dto';
import { ProfileService } from './profile.service';

@ApiTags('Profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('nannies/me/portfolio')
  @Roles(UserRole.NANNY)
  @ApiOperation({ summary: 'Get logged-in nanny own portfolio screen data' })
  getMyNannyPortfolio(@CurrentUser() user: CurrentUserPayload) {
    return this.profileService.getMyNannyPortfolio(user);
  }

  @Get('children/:childId/nannies/:nannyUserId/portfolio')
  @Roles(UserRole.ADMIN, UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({
    summary: 'Get assigned nanny portfolio and insight cards for one child',
  })
  @ApiParam({ name: 'childId' })
  @ApiParam({ name: 'nannyUserId' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['overview', 'week', 'month'],
  })
  @ApiQuery({ name: 'month', required: false, description: 'Month 1-12' })
  @ApiQuery({ name: 'week', required: false, description: 'Week 1-5' })
  getAssignedNannyPortfolio(
    @CurrentUser() user: CurrentUserPayload,
    @Param('childId') childId: string,
    @Param('nannyUserId') nannyUserId: string,
    @Query() query: ProfileNannyPortfolioQueryDto,
  ) {
    return this.profileService.getAssignedNannyPortfolio(
      user,
      childId,
      nannyUserId,
      query,
    );
  }
}
