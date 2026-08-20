import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { join } from 'path';
import { MembershipPlanService } from '../../services/membership-plan.service';

@ApiTags('Membership Plans')
@Controller('membership')
export class MembershipPlansController {
  constructor(
    private readonly membershipPlanService: MembershipPlanService,
  ) {}

  @Get('test-ui')
  @Get('membership-flow-test.html')
  @ApiOperation({ summary: 'Serve the testing HTML interface for membership flows' })
  async serveTestUI(@Res() res: Response) {
    const filePath = join(process.cwd(), 'subscription-flow-test.html');
    return res.sendFile(filePath);
  }

  @Get('plans')
  @ApiOperation({ summary: 'Get all available membership plans' })
  getAllPlans() {
    return this.membershipPlanService.getAllPlans();
  }
}
