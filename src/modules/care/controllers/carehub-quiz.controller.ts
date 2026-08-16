import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';

import { SubmitCareQuizDto } from '../dto/submit-care-quiz.dto';
import { CarehubQuizService } from '../services/carehub-quiz.service';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('(Parent/Nanny) > Care Hub Quiz')
@Controller('care')
export class CarehubQuizController {
  constructor(private readonly careService: CarehubQuizService) {}

  @Post('progress/:progressId/quiz')
  @Roles(UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({
    summary: 'Submit quiz answers and get result review',
  })
  @ApiParam({ name: 'progressId' })
  @ApiBody({ type: SubmitCareQuizDto })
  submitQuiz(
    @CurrentUser() user: CurrentUserPayload,
    @Param('progressId') progressId: string,
    @Body() dto: SubmitCareQuizDto,
  ) {
    return this.careService.submitQuiz(user, progressId, dto);
  }

  @Get('progress/:progressId/result')
  @Roles(UserRole.PARENT, UserRole.NANNY)
  @ApiOperation({
    summary: 'Get completed quiz result review',
  })
  @ApiParam({ name: 'progressId' })
  getQuizResult(
    @CurrentUser() user: CurrentUserPayload,
    @Param('progressId') progressId: string,
  ) {
    return this.careService.getQuizResult(user, progressId);
  }
}
