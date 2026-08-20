import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { CreateMembershipPlanDto } from '../../dto/create-plan.dto';
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

  @Post('plans')
  @ApiOperation({ summary: 'Admin: create a custom membership plan' })
  createPlan(@Body() dto: CreateMembershipPlanDto) {
    return this.membershipPlanService.createPlan(dto);
  }
}
