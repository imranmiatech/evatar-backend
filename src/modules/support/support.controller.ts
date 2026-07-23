import {
  BadRequestException,
  Body,
  Controller,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SupportService } from './support.service';
import { StorageService } from '../../common/storage/storage.service';
import {
  CreateTicketDto,
  SendMessageDto,
  UpdateTicketStatusDto,
} from './dto/support.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import type { Express } from 'express';
import type { User } from '@prisma/client';
import {
  SUPPORT_ATTACHMENT_MAX_BYTES,
  SUPPORT_ATTACHMENT_MIME_TYPES,
} from './support.constants';
import { SupportGateway } from './support.gateway';

@ApiTags('Support')
@ApiBearerAuth()
@Controller('support')
export class SupportController {
  constructor(
    private readonly supportService: SupportService,
    private readonly storageService: StorageService,
    private readonly supportGateway: SupportGateway,
  ) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload a support attachment, including voice messages',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'Attachment file. For voice messages, upload the recorded audio blob as this field.',
        },
      },
    },
  })
  async uploadAttachment(
    @UploadedFile(SupportController.requiredFilePipe())
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const attachment = await this.uploadSupportAttachment(file);
    return {
      success: true,
      message: 'File uploaded successfully',
      url: attachment.url,
      attachmentType: attachment.attachmentType,
    };
  }

  @Post('ticket')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Submit a new support ticket' })
  @ApiResponse({ status: 201, description: 'Ticket submitted successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async createTicket(
    @CurrentUser() user: any,
    @Body() createTicketDto: CreateTicketDto,
  ) {
    return this.supportService.createTicket(user.id, createTicketDto);
  }

  @Get('tickets')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all tickets for the logged in user' })
  @ApiResponse({ status: 200, description: 'Returns a list of tickets.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getMyTickets(@CurrentUser() user: any) {
    return this.supportService.getMyTickets(user.id);
  }

  @Get('tickets/:id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get chat messages for a specific ticket' })
  @ApiResponse({ status: 200, description: 'Returns ticket details and chat history.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Not the ticket owner.' })
  @ApiResponse({ status: 404, description: 'Ticket not found.' })
  async getTicketMessages(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.supportService.getTicketMessages(user.id, id, user.role);
  }

  @Post('tickets/:id/messages')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Send a support text, file, voice message, or text with file',
  })
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Here is the recording for the issue.',
        },
        attachmentUrl: {
          type: 'string',
          example: 'https://res.cloudinary.com/.../voice.webm',
        },
        attachmentType: {
          type: 'string',
          example: 'audio/webm',
        },
        file: {
          type: 'string',
          format: 'binary',
          description:
            'Attachment file. For voice messages, upload the recorded audio blob as this field.',
        },
      },
    },
  })
  async sendTicketMessage(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @UploadedFile(SupportController.optionalFilePipe())
    file?: Express.Multer.File,
  ) {
    if (file) {
      const attachment = await this.uploadSupportAttachment(file);
      dto.attachmentUrl = attachment.url;
      dto.attachmentType = attachment.attachmentType;
    }

    const response = await this.supportService.sendMessage(
      user.id,
      user.role,
      id,
      dto,
    );

    this.supportGateway.broadcastMessage(id, response.data);

    return response;
  }

  @Patch('tickets/:id/resolve')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Mark a ticket as resolved (User only)' })
  @ApiResponse({ status: 200, description: 'Ticket marked as resolved.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Not the ticket owner.' })
  @ApiResponse({ status: 404, description: 'Ticket not found.' })
  async resolveTicket(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.supportService.resolveTicket(user.id, id);
  }

  // --- ADMIN ROUTES ---

  @Get('admin/tickets')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get all tickets (Admin only)' })
  @ApiResponse({ status: 200, description: 'Returns all tickets across all users.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Admin only.' })
  async getAllTickets() {
    return this.supportService.getAllTickets();
  }

  @Patch('admin/tickets/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update the status of a ticket (Admin only)' })
  @ApiResponse({ status: 200, description: 'Ticket status updated successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Admin only.' })
  @ApiResponse({ status: 404, description: 'Ticket not found.' })
  async updateTicketStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateTicketStatusDto,
  ) {
    return this.supportService.updateTicketStatus(id, updateDto.status);
  }

  private static requiredFilePipe() {
    return SupportController.filePipe(true);
  }

  private static optionalFilePipe() {
    return SupportController.filePipe(false);
  }

  private async uploadSupportAttachment(file: Express.Multer.File) {
    const url = await this.storageService.uploadFile(
      file,
      'support-attachments',
    );

    return {
      url,
      attachmentType: file.mimetype,
      fileName: file.originalname,
      size: file.size,
    };
  }

  private static filePipe(fileIsRequired: boolean) {
    return new ParseFilePipe({
      fileIsRequired,
      validators: [
        new MaxFileSizeValidator({
          maxSize: SUPPORT_ATTACHMENT_MAX_BYTES,
          message: 'File size must be 10MB or less',
        }),
        new FileTypeValidator({
          fileType: new RegExp(
            `^(${SUPPORT_ATTACHMENT_MIME_TYPES.map((type) =>
              type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            ).join('|')})$`,
          ),
          skipMagicNumbersValidation: true,
        }),
      ],
    });
  }
}
