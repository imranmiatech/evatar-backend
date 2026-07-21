import { IsString, IsOptional, IsEmail, IsUrl } from 'class-validator';
import { ApiPropertyOptional, ApiHideProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'Full name of the user' })
  @IsOptional()
  @IsString()
  fullName?: string;


  @ApiPropertyOptional({ description: 'Phone number of the user' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: 'Profile picture image file',
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  profilePicture?: any;


  @ApiHideProperty()
  @IsOptional()
  @IsString()
  profilePictureUrl?: string;

  @ApiPropertyOptional({ description: 'Preferred language' })
  @IsOptional()
  @IsString()
  preferredLanguage?: string;

  @ApiPropertyOptional({ description: 'Relationship' })
  @IsOptional()
  @IsString()
  relationShip?: string;
}
