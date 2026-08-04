import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { plainToInstance, Transform, Type } from 'class-transformer';
import { RecipeMealType, Difficulty, ContentStatus, ItemUnit } from '@prisma/client';

class RecipeIngredientDto {
  @ApiProperty({ example: 'Blueberries' })
  @IsString()
  name: string;

  @ApiProperty({ example: '100' })
  @IsString()
  amount: string;

  @ApiPropertyOptional({ enum: ItemUnit, example: ItemUnit.GM })
  @IsOptional()
  @IsEnum(ItemUnit)
  unit?: ItemUnit;

  @ApiPropertyOptional({ example: 'Strawberries' })
  @IsOptional()
  @IsString()
  substitute?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;
}

class RecipeStepDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  stepNumber: number;

  @ApiProperty({ example: 'Wash and blend the blueberries.' })
  @IsString()
  description: string;
}

export class CreateRecipeDto {
  @ApiProperty({ example: 'Blueberry Oat Porridge' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Soft, naturally sweet pancakes made with bananas and oats, suitable for toddlers.' })
  @IsOptional()
  @IsString()
  shortDescription?: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Cover image file upload' })
  @IsOptional()
  coverImage?: any;

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Video file upload' })
  @IsOptional()
  video?: any;

  @ApiProperty({ enum: RecipeMealType, example: RecipeMealType.BREAKFAST })
  @IsEnum(RecipeMealType)
  recipeMealType: RecipeMealType;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsNumber()
  minAgeMonths?: number;

  @ApiPropertyOptional({ example: 24 })
  @IsOptional()
  @IsNumber()
  maxAgeMonths?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  prepTimeMin?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  cookTimeMin?: number;

  @ApiPropertyOptional({ enum: Difficulty, example: Difficulty.EASY })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @ApiPropertyOptional({ example: '2-3' })
  @IsOptional()
  @IsString()
  servings?: string;

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      return value.split(',').map(s => s.trim());
    }
    return Array.isArray(value) ? value : [value];
  })
  @ApiPropertyOptional({ example: ['Growth & Energy', 'Finger Food Friendly', 'Balanced'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  nutritionalFocus?: string[];

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      return value.split(',').map(s => s.trim());
    }
    return Array.isArray(value) ? value : [value];
  })
  @ApiPropertyOptional({ example: ['Egg', 'Gluten'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergens?: string[];

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      return value.split(',').map(s => s.trim());
    }
    return Array.isArray(value) ? value : [value];
  })
  @ApiPropertyOptional({ example: ['Sweet', 'Soft texture', 'Finger food friendly'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  childPreferenceTags?: string[];

  @ApiPropertyOptional({ example: 'Flip and cook for 2 more minutes until golden and firm.' })
  @IsOptional()
  @IsString()
  cookingTips?: string;

  @ApiPropertyOptional({ example: 'Serve in soft strips or small toddler-safe pieces.' })
  @IsOptional()
  @IsString()
  safetyNotes?: string;

  @ApiPropertyOptional({ enum: ContentStatus, example: ContentStatus.PUBLISHED })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;



  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map((item: any) => plainToInstance(RecipeIngredientDto, item)) : parsed;
      } catch { return value; }
    }
    if (Array.isArray(value)) {
      return value.map((item: any) => plainToInstance(RecipeIngredientDto, item));
    }
    return value;
  })
  @ApiProperty({ type: 'string', description: 'JSON stringified array of ingredients', example: `[
  { "name": "Organic Banana", "amount": "1", "unit": "UNIT", "substitute": "Apple puree", "isOptional": false },
  { "name": "Egg", "amount": "1", "unit": "UNIT", "substitute": "Flax egg", "isOptional": false },
  { "name": "Oats", "amount": "3", "unit": "TBSP", "substitute": "Oat flour", "isOptional": false }
]` })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients: RecipeIngredientDto[];

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map((item: any) => plainToInstance(RecipeStepDto, item)) : parsed;
      } catch { return value; }
    }
    if (Array.isArray(value)) {
      return value.map((item: any) => plainToInstance(RecipeStepDto, item));
    }
    return value;
  })
  @ApiProperty({ type: 'string', description: 'JSON stringified array of steps', example: `[
  { "stepNumber": 1, "description": "Mash banana in a bowl until completely smooth with no lumps." },
  { "stepNumber": 2, "description": "Add egg and oats and mix until a thick batter forms." }
]` })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeStepDto)
  steps: RecipeStepDto[];
}
