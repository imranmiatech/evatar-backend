import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
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
import { SubmitDocumentsDto } from './dto/submit-documents.dto';
import { KycService } from './kyc.service';
import { SumsubService } from './sumsub.service';

const KYC_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;
const KYC_DOCUMENT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@ApiTags('KYC Documents')
@Controller('kyc')
export class KycController {
  constructor(
    private readonly kycService: KycService,
    private readonly sumsubService: SumsubService,
  ) {}

  @Post('sumsub/access-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate Sumsub SDK access token for identity verification',
  })
  generateSumsubAccessToken(@CurrentUser() user: CurrentUserPayload) {
    return this.sumsubService.generateSdkAccessToken(user.userId);
  }

  @Post('sumsub/webhook')
  @ApiOperation({
    summary: 'Public Sumsub webhook endpoint for verification status updates',
  })
  handleSumsubWebhook(
    @Req() req: any,
    @Body() payload: any,
    @Headers('x-payload-digest') digest?: string,
    @Headers('x-payload-digest-alg') digestAlg?: string,
  ) {
    const rawBody = req.rawBody instanceof Buffer
      ? req.rawBody
      : Buffer.from(JSON.stringify(payload || {}));

    return this.sumsubService.handleWebhook(payload, rawBody, digest, digestAlg);
  }

  @Post('documents')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'passport', maxCount: 1 },
      { name: 'nidFront', maxCount: 1 },
      { name: 'nidBack', maxCount: 1 },
    ]),
  )
  @ApiOperation({
    summary:
      'Save parent Passport or National ID document images after account/OTP flow',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['docType'],
      properties: {
        docType: {
          type: 'string',
          enum: ['PASSPORT', 'NATIONAL_ID'],
          example: 'NATIONAL_ID',
        },
        passport: {
          type: 'string',
          format: 'binary',
          description: 'Required when docType is PASSPORT.',
        },
        nidFront: {
          type: 'string',
          format: 'binary',
          description: 'Required when docType is NATIONAL_ID.',
        },
        nidBack: {
          type: 'string',
          format: 'binary',
          description: 'Required when docType is NATIONAL_ID.',
        },
      },
    },
  })
  submitDocuments(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SubmitDocumentsDto,
    @UploadedFiles()
    files: {
      passport?: Express.Multer.File[];
      nidFront?: Express.Multer.File[];
      nidBack?: Express.Multer.File[];
    },
  ) {
    KycController.validateFiles(files);
    return this.kycService.submitDocuments(user.userId, dto.docType, files);
  }

  @Patch('documents/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'passport', maxCount: 1 },
      { name: 'nidFront', maxCount: 1 },
      { name: 'nidBack', maxCount: 1 },
    ]),
  )
  @ApiOperation({
    summary: 'Update parent Passport or National ID document images',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['docType'],
      properties: {
        docType: {
          type: 'string',
          enum: ['PASSPORT', 'NATIONAL_ID'],
          example: 'NATIONAL_ID',
        },
        passport: {
          type: 'string',
          format: 'binary',
          description: 'Required when docType is PASSPORT.',
        },
        nidFront: {
          type: 'string',
          format: 'binary',
          description: 'Required when docType is NATIONAL_ID.',
        },
        nidBack: {
          type: 'string',
          format: 'binary',
          description: 'Required when docType is NATIONAL_ID.',
        },
      },
    },
  })
  updateDocuments(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: SubmitDocumentsDto,
    @UploadedFiles()
    files: {
      passport?: Express.Multer.File[];
      nidFront?: Express.Multer.File[];
      nidBack?: Express.Multer.File[];
    },
  ) {
    KycController.validateFiles(files);
    return this.kycService.updateDocuments(
      user.userId,
      id,
      dto.docType,
      files,
    );
  }

  @Post('face-check')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('selfie'))
  @ApiOperation({
    summary: 'Save live selfie image after document upload for identity check',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['selfie'],
      properties: {
        selfie: {
          type: 'string',
          format: 'binary',
          description: 'Captured live selfie frame from the identity screen.',
        },
      },
    },
  })
  submitFaceCheck(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() selfie: Express.Multer.File,
  ) {
    KycController.validateFile(selfie);
    return this.kycService.submitFaceCheck(user.userId, selfie);
  }

  @Get('documents')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my saved KYC document submissions' })
  getDocuments(@CurrentUser() user: CurrentUserPayload) {
    return this.kycService.getMyDocuments(user.userId);
  }

  private static validateFiles(files: {
    passport?: Express.Multer.File[];
    nidFront?: Express.Multer.File[];
    nidBack?: Express.Multer.File[];
  }) {
    const uploadedFiles = [
      ...(files.passport ?? []),
      ...(files.nidFront ?? []),
      ...(files.nidBack ?? []),
    ];

    uploadedFiles.forEach((file) => KycController.validateFile(file));
  }

  private static validateFile(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Document image is required');
    }

    if (file.size > KYC_DOCUMENT_MAX_BYTES) {
      throw new BadRequestException('Document image must be 25MB or less');
    }

    if (!KYC_DOCUMENT_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Document image must be jpeg, png, or webp',
      );
    }
  }
}
