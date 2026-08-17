import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

const optionalBoolean = ({ value }: { value: unknown }) => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
};

export class ManageSystemPermissionsDto {
  @ApiPropertyOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  @IsOptional()
  dailyActivitiesRecipes?: boolean;

  @ApiPropertyOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  @IsOptional()
  manageDailyPlans?: boolean;

  @ApiPropertyOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  @IsOptional()
  viewGroceryLists?: boolean;

  @ApiPropertyOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  @IsOptional()
  manageGroceryLists?: boolean;

  @ApiPropertyOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  @IsOptional()
  editChildProfile?: boolean;

  @ApiPropertyOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  @IsOptional()
  accessChildInsights?: boolean;

  @ApiPropertyOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  @IsOptional()
  addRemoveChildren?: boolean;

  @ApiPropertyOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  @IsOptional()
  manageBilling?: boolean;

  @ApiPropertyOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  @IsOptional()
  manageCareTeam?: boolean;

  @ApiPropertyOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  @IsOptional()
  manageGroceryOrders?: boolean;

  @ApiPropertyOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  @IsOptional()
  groceryOrdering?: boolean;

  @ApiPropertyOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  @IsOptional()
  careLearningAccess?: boolean;

  @ApiPropertyOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  @IsOptional()
  nannyDevelopment?: boolean;

  @ApiPropertyOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  @IsOptional()
  memoriesStories?: boolean;
}
