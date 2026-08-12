import { PartialType } from '@nestjs/swagger';
import { CreateRecurringActivityDto } from './create-recurring-activity.dto';

export class UpdateRecurringActivityDto extends PartialType(
  CreateRecurringActivityDto,
) {}
