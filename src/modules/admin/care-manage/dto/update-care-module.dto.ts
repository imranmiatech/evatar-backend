import { PartialType } from '@nestjs/swagger';
import { CreateCareModuleDto } from './create-care-module.dto';

export class UpdateCareModuleDto extends PartialType(CreateCareModuleDto) {}
