import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, MembershipPlan } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const SIGNUP_ROLE_OPTIONS = [UserRole.PARENT, UserRole.NANNY] as const;
export const OTP_DELIVERY_OPTIONS = ['EMAIL', 'PHONE'] as const;

export class SignupDto {
  @ApiProperty({ example: 'John Doe', description: 'Full name of the user' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'john@example.com', description: 'User email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: '+971501234567', description: 'User mobile number' })
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
}
