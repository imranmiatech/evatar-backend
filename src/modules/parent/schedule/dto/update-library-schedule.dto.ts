import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateLibraryScheduleDto } from './create-library-schedule.dto';

export class UpdateLibraryScheduleDto extends PartialType(
  OmitType(CreateLibraryScheduleDto, ['childId'] as const),
) {}
