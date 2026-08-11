import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifySignupOtpDto } from './dto/verify-signup-otp.dto';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOperation({
    summary: 'Register a Parent, Nanny, or Partner',
    description:
      'Parent and Nanny accounts receive signup OTP verification. Partner accounts are submitted as PENDING and can log in only after admin approval.',
  })
  @ApiBody({
    type: SignupDto,
    examples: {
      parent: {
        summary: 'Parent signup',
        value: {
          fullName: 'Parent User',
          email: 'parent@example.com',
          phoneNumber: '+8801700000001',
          password: '123456',
          preferredLanguage: 'en',
          role: 'PARENT',
          otpDeliveryMethod: 'EMAIL',
          relationType: 'FATHER',
          street: 'Dubai Street',
          postCode: '1230',
          city: 'Dubai',
          state: 'Dubai',
          country: 'UAE',
          membershipPlan: 'TRIAL',
        },
      },
      nanny: {
        summary: 'Nanny signup',
        value: {
          fullName: 'Nanny User',
          email: 'nanny@example.com',
          phoneNumber: '+8801700000002',
          password: '123456',
          preferredLanguage: 'en',
          role: 'NANNY',
          otpDeliveryMethod: 'EMAIL',
        },
      },
      partner: {
        summary: 'Partner signup request',
        description:
          'Creates a pending partner request, partner profile, and first store. No signup OTP is required; admin approval is required before login.',
        value: {
          role: 'PARTNER',
          businessName: 'Carrefour',
          businessCategory: 'Grocery & Supermarket',
          shortDescription: 'Family grocery partner with in-store rewards.',
          website: 'https://partner.example.com',
          email: 'hello@business.com',
          phoneNumber: '+447700900000',
          password: 'Password123!',
          businessCountry: 'United Arab Emirates',
          businessCity: 'Dubai',
          businessAddress: '123 High Street, Dubai',
          openingHours: 'Mon-Fri 9:00-18:00',
          contactPerson: 'Jane Smith',
          contactRole: 'Manager',
          contactEmail: 'jane@business.com',
          contactPhone: '+447700900001',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description:
      'Parent/Nanny: account created and OTP generated. Partner: request submitted and waiting for admin approval.',
  })
  @ApiResponse({ status: 400, description: 'Validation failed or user already exists.' })
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @Post(['signin', 'login'])
  @ApiOperation({
    summary: 'User login',
    description:
      'Partner users can log in only after admin approval. Pending or rejected partner accounts receive a blocking message.',
  })
  @ApiBody({
    type: SigninDto,
    examples: {
      parentOrNanny: {
        summary: 'Parent/Nanny login',
        value: {
          email: 'parent@example.com',
          password: 'Password123!',
        },
      },
      partner: {
        summary: 'Approved Partner login',
        value: {
          email: 'hello@business.com',
          password: 'Password123!',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'User successfully logged in.' })
  @ApiResponse({
    status: 400,
    description:
      'Invalid credentials, inactive account, pending partner approval, or rejected partner request.',
  })
  async signin(
    @Body() signinDto: SigninDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user, message } = await this.authService.signin(signinDto);

    // Set cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'development',
      sameSite: 'strict',
      maxAge: 120 * 60 * 1000, // 120 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'development',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      message,
      user,
      accessToken, // Optional: return in body as well for mobile clients
      refreshToken, // Optional
    };
  }

  @Post('logout')
  @ApiOperation({ summary: 'User logout' })
  @ApiResponse({ status: 200, description: 'User successfully logged out.' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return {
      message: 'Logged out successfully',
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current logged-in user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile returned successfully.' })
  @ApiResponse({ status: 401, description: 'Missing, invalid, or expired access token.' })
  async me(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.me(user);
  }

  @Post('forgot-password')
  @ApiOperation({
    summary: 'Request password reset OTP',
    description:
      'Works for Parent, Nanny, and Partner accounts. Partner approval status does not change during password reset.',
  })
  @ApiBody({
    type: ForgotPasswordDto,
    examples: {
      email: {
        summary: 'Send reset OTP by email',
        value: { email: 'hello@business.com' },
      },
      phone: {
        summary: 'Send reset OTP by phone',
        value: { phoneNumber: '+447700900000' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'OTP sent to email or phone successfully.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('verify-signup-otp')
  @ApiOperation({ summary: 'Verify signup OTP and activate account' })
  @ApiResponse({ status: 200, description: 'Signup OTP verified successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP.' })
  async verifySignupOtp(@Body() dto: VerifySignupOtpDto) {
    return this.authService.verifySignupOtp(dto);
  }

  @Post('reset-password')
  @ApiOperation({
    summary: 'Reset user password using OTP',
    description:
      'Works for Parent, Nanny, and Partner accounts. Pending/rejected partners still cannot log in until approved.',
  })
  @ApiBody({
    type: ResetPasswordDto,
    examples: {
      partner: {
        summary: 'Partner reset password',
        value: {
          email: 'hello@business.com',
          otpCode: '1234',
          newPassword: 'NewPassword123!',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Password successfully reset.' })
  @ApiResponse({ status: 400, description: 'Invalid OTP or expired.' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
