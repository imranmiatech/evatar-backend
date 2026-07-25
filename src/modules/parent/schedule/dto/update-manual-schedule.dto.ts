import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateManualScheduleDto } from './create-manual-schedule.dto';

export class UpdateManualScheduleDto extends PartialType(
  OmitType(CreateManualScheduleDto, ['childId'] as const),
) {}
