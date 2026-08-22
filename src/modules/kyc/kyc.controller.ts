import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import type {} from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  SUMSUB_KYC_ALLOWED_MIME_TYPES,
  SUMSUB_KYC_MAX_FILE_BYTES,
} from './constants/sumsub-kyc.constants';
import { KycService } from './kyc.service';
import { SumsubService } from './sumsub.service';
import { CreateKycSessionDto } from './dto/create-kyc-session.dto';
import { CreateLivenessActionDto } from './dto/create-liveness-action.dto';
import { SubmitDocumentsDto } from './dto/submit-documents.dto';

@ApiTags('KYC')
@Controller('kyc')
export class KycController {
  constructor(
    private readonly kycService: KycService,
    private readonly sumsubService: SumsubService,
  ) {}

  @Get('flow-config')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get KYC flow capabilities for custom UI and required SDK steps',
  })
  getFlowConfig() {
    return this.kycService.getFlowConfiguration();
  }

  @Post('session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create or resume a Sumsub KYC applicant session',
  })
  createSession(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateKycSessionDto,
  ) {
    return this.kycService.createVerificationSession(user.userId, dto);
  }

  @Post('sumsub/access-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate Sumsub SDK access token for the standard applicant flow',
  })
  generateSumsubAccessToken(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateKycSessionDto,
  ) {
    return this.sumsubService.generateSdkAccessToken(user.userId, {
      lang: dto?.lang,
    });
  }

  @Post('documents')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(AnyFilesInterceptor())
  @ApiOperation({
    summary: 'Upload identity documents through your custom UI via Sumsub REST API',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['docType', 'countryCode'],
      properties: {
        docType: {
          type: 'string',
          enum: [
            'PASSPORT',
            'NATIONAL_ID',
            'ID_CARD',
            'DRIVERS_LICENSE',
            'RESIDENCE_PERMIT',
            'OTHER',
          ],
        },
        countryCode: {
          type: 'string',
          example: 'USA',
        },
        sumsubIdDocType: {
          type: 'string',
          example: 'DRIVERS',
        },
        document: {
          type: 'string',
          format: 'binary',
          description: 'Single-file document upload such as a passport.',
        },
        front: {
          type: 'string',
          format: 'binary',
          description: 'Front side of a multi-side document.',
        },
        back: {
          type: 'string',
          format: 'binary',
          description: 'Back side of a multi-side document when required.',
        },
      },
    },
  })
  submitDocuments(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SubmitDocumentsDto,
    @UploadedFiles() uploadedFiles: Express.Multer.File[],
  ) {
    const files = KycController.groupFilesByField(uploadedFiles);
    KycController.validateFiles(uploadedFiles);
    return this.kycService.submitDocumentsWithCustomUi(user.userId, dto, files);
  }

  @Post('review')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Request Sumsub review after custom document upload is complete',
  })
  requestReview(@CurrentUser() user: CurrentUserPayload) {
    return this.kycService.requestVerificationReview(user.userId);
  }

  @Post('liveness-action')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create the Sumsub liveness and face-match action for SDK handoff',
  })
  createLivenessAction(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateLivenessActionDto,
  ) {
    return this.kycService.createLivenessAction(user.userId, dto);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get local KYC state plus the latest Sumsub applicant status',
  })
  getStatus(@CurrentUser() user: CurrentUserPayload) {
    return this.kycService.getMyVerificationStatus(user.userId);
  }

  @Post('sumsub/webhook')
  @ApiOperation({
    summary: 'Public Sumsub webhook endpoint for applicant and action updates',
  })
  handleSumsubWebhook(
    @Req() req: any,
    @Body() payload: any,
    @Headers('x-payload-digest') digest?: string,
    @Headers('x-payload-digest-alg') digestAlg?: string,
  ) {
    const rawBody =
      req.rawBody instanceof Buffer
        ? req.rawBody
        : Buffer.from(JSON.stringify(payload || {}));

    return this.sumsubService.handleWebhook(payload, rawBody, digest, digestAlg);
  }

  private static groupFilesByField(uploadedFiles: Express.Multer.File[]) {
    const grouped: {
      document?: Express.Multer.File[];
      front?: Express.Multer.File[];
      back?: Express.Multer.File[];
    } = {};

    for (const file of uploadedFiles || []) {
      if (
        file.fieldname !== 'document' &&
        file.fieldname !== 'front' &&
        file.fieldname !== 'back'
      ) {
        throw new BadRequestException(
          `Unsupported file field "${file.fieldname}". Use document, front, or back.`,
        );
      }

      grouped[file.fieldname] = [...(grouped[file.fieldname] || []), file];
    }

    return grouped;
  }

  private static validateFiles(files: Express.Multer.File[]) {
    for (const file of files || []) {
      if (file.size > SUMSUB_KYC_MAX_FILE_BYTES) {
        throw new BadRequestException('Document file must be 50MB or less');
      }

      if (!SUMSUB_KYC_ALLOWED_MIME_TYPES.includes(file.mimetype as never)) {
        throw new BadRequestException(
          `Document file must be one of: ${SUMSUB_KYC_ALLOWED_MIME_TYPES.join(', ')}`,
        );
      }
    }
  }
}
