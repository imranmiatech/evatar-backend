import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateVoucherDto {
  @ApiProperty({ example: 'seed-child-eve' })
  @IsString()
  childId!: string;

  @ApiPropertyOptional({ example: 'shopping-list-id' })
  @IsString()
  @IsOptional()
  shoppingListId?: string;

  @ApiPropertyOptional({ example: 'store-id' })
  @IsString()
  @IsOptional()
  storeId?: string;

  @ApiPropertyOptional({ example: 'Please prioritize fresh items.' })
  @IsString()
  @IsOptional()
  messageToParent?: string;

  @ApiPropertyOptional({ example: 'Avoid peanut cross-contact.' })
  @IsString()
  @IsOptional()
  messageToStore?: string;

  @ApiPropertyOptional({ example: ['Peanut allergy'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allergyWarnings?: string[];

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  substitutionRules?: Record<string, unknown>;
}

