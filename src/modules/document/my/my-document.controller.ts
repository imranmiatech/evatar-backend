import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { MyDocumentService } from './my-document.service';
import { UploadDocumentDto } from './dto/upload-document.dto';

@ApiTags('Documents / My Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents/my')
export class MyDocumentController {
  constructor(private readonly myDocumentService: MyDocumentService) {}

  @Get()
  @ApiOperation({
    summary: 'Screen 1: Get my verified documents (Passport, National ID)',
    description:
      'Fetches logged-in user documents status, verified dates, and file URLs matching My Documents tab.',
  })
  getMyDocuments(@CurrentUser() user: CurrentUserPayload) {
    return this.myDocumentService.getMyDocuments(user.userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Screen 3: Preview/Get specific document details by ID',
    description: 'Retrieves document file URL and metadata for document preview/download modal.',
  })
  @ApiParam({ name: 'id', description: 'Document ID' })
  getMyDocumentById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.myDocumentService.getMyDocumentById(user.userId, id);
  }

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'passport', maxCount: 1 },
      { name: 'nidFront', maxCount: 1 },
      { name: 'nidBack', maxCount: 1 },
    ]),
  )
  @ApiOperation({
    summary: 'Screen 1: Upload my Passport or National ID document files',
    description: 'Uploads passport or NID front/back images for verification.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadDocumentDto })
  uploadMyDocument(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UploadDocumentDto,
    @UploadedFiles()
    files: {
      passport?: Express.Multer.File[];
      nidFront?: Express.Multer.File[];
      nidBack?: Express.Multer.File[];
    },
  ) {
    return this.myDocumentService.uploadMyDocument(user.userId, dto.docType, files);
  }
}
