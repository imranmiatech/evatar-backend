import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { UserRole, MembershipPlan } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const SIGNUP_ROLE_OPTIONS = [UserRole.PARENT, UserRole.NANNY, UserRole.PARTNER] as const;
export const OTP_DELIVERY_OPTIONS = ['EMAIL', 'PHONE'] as const;

const optionalString = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

export class SignupDto {
  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'Full name of the user. Required for Parent and Nanny; Partner uses businessName.',
  })
  @ValidateIf((o) => o.role !== UserRole.PARTNER)
  @IsString()
  @IsNotEmpty()
  fullName?: string;

  @ApiProperty({ example: 'john@example.com', description: 'User email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: '+971501234567', description: 'User mobile number' })
  @Transform(optionalString)
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({ example: 'Password123!', description: 'Strong password' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: 'en', description: 'Preferred language' })
  @IsString()
  @IsOptional()
  preferredLanguage?: string;

  @ApiProperty({
    enum: SIGNUP_ROLE_OPTIONS,
    enumName: 'SignupRole',
    example: UserRole.PARENT,
    description: 'Select account role for signup',
  })
  @IsIn(SIGNUP_ROLE_OPTIONS)
  role: UserRole;

  @ApiPropertyOptional({
    enum: OTP_DELIVERY_OPTIONS,
    enumName: 'OtpDeliveryMethod',
    example: 'EMAIL',
    description: 'Where to send the OTP code',
  })
  @IsIn(OTP_DELIVERY_OPTIONS)
  @IsOptional()
  otpDeliveryMethod?: string;

  // --- PARENT SPECIFIC FIELDS ---

  @ApiPropertyOptional({ example: 'father', description: 'Relation with the child' })
  @ValidateIf((o) => o.role === UserRole.PARENT)
  @IsString()
  @IsNotEmpty()
  relationType?: string;

  @ApiPropertyOptional({ example: 'Sheikh Zayed Road', description: 'Street address' })
  @IsString()
  @IsOptional()
  street?: string;

  @ApiPropertyOptional({ example: '12345', description: 'Postal code' })
  @IsString()
  @IsOptional()
  postCode?: string;

  @ApiPropertyOptional({ example: 'Dubai', description: 'City' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: 'Dubai', description: 'State' })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({ example: 'United Arab Emirates', description: 'Country' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({
    enum: MembershipPlan,
    enumName: 'MembershipPlan',
    description: 'Selected membership plan',
  })
  @IsEnum(MembershipPlan)
  @IsOptional()
  membershipPlan?: MembershipPlan;

  // --- PARTNER SPECIFIC FIELDS ---

  @ApiPropertyOptional({
    example: 'Carrefour',
    description: 'Required when role is PARTNER. Official partner business name.',
  })
  @ValidateIf((o) => o.role === UserRole.PARTNER)
  @IsString()
  @IsNotEmpty()
  businessName?: string;

  @ApiPropertyOptional({
    example: 'Grocery & Supermarket',
    description:
      'Required when role is PARTNER. Examples: Supermarket, Entertainment, Toy Stores, Indoor Playgrounds, Learning Centres, Book Stores, Children’s Cafés, Other.',
  })
  @ValidateIf((o) => o.role === UserRole.PARTNER)
  @IsString()
  @IsNotEmpty()
  businessCategory?: string;

  @ApiPropertyOptional({
    example: 'Family-friendly cafe with healthy snacks and play space.',
    description: 'Short business description',
  })
  @Transform(optionalString)
  @IsString()
  @IsOptional()
  shortDescription?: string;

  @ApiPropertyOptional({ example: 'https://partner.example.com', description: 'Business website' })
  @Transform(optionalString)
  @IsUrl({ require_protocol: true })
  @IsOptional()
  website?: string;

  @ApiPropertyOptional({
    example: 'United Arab Emirates',
    description: 'Required when role is PARTNER. Partner business country.',
  })
  @ValidateIf((o) => o.role === UserRole.PARTNER)
  @IsString()
  @IsNotEmpty()
  businessCountry?: string;

  @ApiPropertyOptional({
    example: 'Dubai',
    description: 'Required when role is PARTNER. Partner business city.',
  })
  @ValidateIf((o) => o.role === UserRole.PARTNER)
  @IsString()
  @IsNotEmpty()
  businessCity?: string;

  @ApiPropertyOptional({
    example: '123 High Street, Dubai',
    description: 'Required when role is PARTNER. Partner business address.',
  })
  @ValidateIf((o) => o.role === UserRole.PARTNER)
  @IsString()
  @IsNotEmpty()
  businessAddress?: string;

  @ApiPropertyOptional({ example: 'Mon-Fri 9:00-18:00', description: 'Opening hours' })
  @Transform(optionalString)
  @IsString()
  @IsOptional()
  openingHours?: string;

  @ApiPropertyOptional({
    example: 'Jane Smith',
    description: 'Required when role is PARTNER. Primary contact person.',
  })
  @ValidateIf((o) => o.role === UserRole.PARTNER)
  @IsString()
  @IsNotEmpty()
  contactPerson?: string;

  @ApiPropertyOptional({ example: 'Manager', description: 'Primary contact role/title' })
  @Transform(optionalString)
  @IsString()
  @IsOptional()
  contactRole?: string;

  @ApiPropertyOptional({ example: 'jane@business.com', description: 'Primary contact email' })
  @Transform(optionalString)
  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @ApiPropertyOptional({ example: '+447700900001', description: 'Primary contact phone' })
  @Transform(optionalString)
  @IsString()
  @IsOptional()
  contactPhone?: string;
}
