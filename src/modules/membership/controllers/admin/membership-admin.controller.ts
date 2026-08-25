import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { CreateMembershipPlanDto } from '../../dto/create-plan.dto';
import { UpdateMembershipPlanDto } from '../../dto/update-plan.dto';
import { MembershipPlanService } from '../../services/membership-plan.service';

@ApiTags('Membership Admin')
@Controller('membership/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class MembershipAdminController {
  constructor(
    private readonly membershipPlanService: MembershipPlanService,
  ) {}

  @Get('plans')
  @ApiOperation({ summary: 'Admin: get all membership plans including inactive' })
  getPlans() {
    return this.membershipPlanService.getAdminPlans();
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Admin: get a single membership plan by id' })
  getPlanById(@Param('id') planId: string) {
    return this.membershipPlanService.getAdminPlanById(planId);
  }

  @Post('plans')
  @ApiOperation({ summary: 'Admin: create a custom membership plan' })
  createPlan(@Body() dto: CreateMembershipPlanDto) {
    return this.membershipPlanService.createPlan(dto);
  }

  @Patch('plans/:id')
  @ApiOperation({ summary: 'Admin: update a membership plan' })
  updatePlan(
    @Param('id') planId: string,
    @Body() dto: UpdateMembershipPlanDto,
  ) {
    return this.membershipPlanService.updatePlan(planId, dto);
  }

  @Delete('plans/:id')
  @ApiOperation({ summary: 'Admin: deactivate a membership plan' })
  deletePlan(@Param('id') planId: string) {
    return this.membershipPlanService.deletePlan(planId);
  }
}
