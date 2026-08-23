import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
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
import { UpdateMyNannyPortfolioDto } from './dto/update-my-nanny-portfolio.dto';
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

  @Get('nannies/me/portfolio/insights')
  @Roles(UserRole.NANNY)
  @ApiOperation({ summary: 'Get logged-in nanny own portfolio insights tab data' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['overview', 'week', 'month'],
  })
  @ApiQuery({ name: 'month', required: false, description: 'Month 1-12' })
  @ApiQuery({ name: 'week', required: false, description: 'Week 1-5' })
  getMyNannyPortfolioInsights(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ProfileNannyPortfolioQueryDto,
  ) {
    return this.profileService.getMyNannyPortfolioInsights(user, query);
  }

  @Get('nannies/me/portfolio/screen-time')
  @Roles(UserRole.NANNY)
  @ApiOperation({
    summary:
      'Get logged-in nanny own portfolio screen time card data from care quiz usage',
  })
  getMyNannyPortfolioScreenTime(@CurrentUser() user: CurrentUserPayload) {
    return this.profileService.getMyNannyPortfolioScreenTime(user);
  }

  @Patch('nannies/me/portfolio')
  @Roles(UserRole.NANNY)
  @ApiOperation({
    summary:
      'Update logged-in nanny portfolio skills, training, and professional experience',
  })
  @ApiBody({ type: UpdateMyNannyPortfolioDto })
  updateMyNannyPortfolio(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateMyNannyPortfolioDto,
  ) {
    return this.profileService.updateMyNannyPortfolio(user, dto);
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
