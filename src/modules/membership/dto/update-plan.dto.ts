import { PartialType } from '@nestjs/swagger';
import { CreateMembershipPlanDto } from './create-plan.dto';

export class UpdateMembershipPlanDto extends PartialType(
  CreateMembershipPlanDto,
) {}
