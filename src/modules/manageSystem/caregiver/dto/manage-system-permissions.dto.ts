import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class ManageSystemPermissionsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dailyActivitiesRecipes?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  manageDailyPlans?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  viewGroceryLists?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  manageGroceryLists?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  editChildProfile?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  accessChildInsights?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  addRemoveChildren?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  manageBilling?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  manageCareTeam?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  manageGroceryOrders?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  groceryOrdering?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  careLearningAccess?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  nannyDevelopment?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  memoriesStories?: boolean;
}
