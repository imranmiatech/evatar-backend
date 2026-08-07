import {
  Body,
  Controller,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  ParseFilePipe,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { User } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StorageService } from '../../common/storage/storage.service';
import { CreateConversationDto, SendChatMessageDto } from './dto/message.dto';
import {
  MESSAGE_ATTACHMENT_MAX_BYTES,
  MESSAGE_ATTACHMENT_MIME_TYPES,
} from './message.constants';
import { MessageService } from './message.service';

@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessageController {
  constructor(
    private readonly messageService: MessageService,
    private readonly storageService: StorageService,
  ) {}

  private getUserId(user: any): string {
    return user?.id || user?.userId || user?.sub || '';
  }

  @Get('contacts')
  @ApiOperation({
    summary: 'List parent, nanny, and family member chat contacts',
  })
  getContacts(@CurrentUser() user: any) {
    return this.messageService.getContacts(this.getUserId(user));
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Create a parent/nanny/family chat conversation' })
  createConversation(
    @CurrentUser() user: any,
    @Body() dto: CreateConversationDto,
  ) {
    return this.messageService.createConversation(this.getUserId(user), dto);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List my chat conversations' })
  getConversations(@CurrentUser() user: any) {
    return this.messageService.getConversations(this.getUserId(user));
  }

  @Get('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Get messages in a conversation' })
  getMessages(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
  ) {
    return this.messageService.getMessages(this.getUserId(user), conversationId);
  }

  @Post('conversations/:conversationId/messages')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Send a text message, file message, voice message, or text with file',
  })
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'What healthy breakfast can I prepare for Eve tomorrow?',
        },
        attachmentUrl: {
          type: 'string',
          example: 'https://res.cloudinary.com/.../image.png',
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
  async sendMessage(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendChatMessageDto,
    @UploadedFile(MessageController.optionalFilePipe())
    file?: Express.Multer.File,
  ) {
    if (file) {
      const attachment = await this.uploadChatAttachment(file);
      dto.attachmentUrl = attachment.url;
      dto.attachmentType = attachment.attachmentType;
    }

    return this.messageService.sendMessage(this.getUserId(user), conversationId, dto);
  }

  @Patch('conversations/:conversationId/read')
  @ApiOperation({ summary: 'Mark a conversation as read' })
  markAsRead(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
  ) {
    return this.messageService.markAsRead(this.getUserId(user), conversationId);
  }

  private async uploadChatAttachment(file: Express.Multer.File) {
    const url = await this.storageService.uploadFile(
      file,
      'message-attachments',
    );

    return {
      url,
      attachmentType: file.mimetype,
      fileName: file.originalname,
      size: file.size,
    };
  }

  private static optionalFilePipe() {
    return new ParseFilePipe({
      fileIsRequired: false,
      validators: [
        new MaxFileSizeValidator({
          maxSize: MESSAGE_ATTACHMENT_MAX_BYTES,
          message: 'File size must be 10MB or less',
        }),
        new FileTypeValidator({
          fileType: new RegExp(
            `^(${MESSAGE_ATTACHMENT_MIME_TYPES.map((type) =>
              type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            ).join('|')})$`,
          ),
          skipMagicNumbersValidation: true,
        }),
      ],
    });
  }
}
