import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";

export class SigninDto {
    @ApiPropertyOptional({
        description: 'User email address',
        example: 'john@example.com'
    })
    @IsString()
    @IsOptional()
    email?: string;

    @ApiPropertyOptional({
        description: 'User phone number with country code',
        example: '+8801943747529'
    })
    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @ApiProperty({
        description: 'User password',
        example: 'Password123!'
    })
    @IsString()
    @MinLength(4)
    password: string;
}