import { Controller, Post, Get, Patch, Body, Param, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SupportService } from './support.service';
import { StorageService } from '../../common/storage/storage.service';
import { CreateTicketDto, UpdateTicketStatusDto } from './dto/support.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import type { Express } from 'express';

@ApiTags('Support')
@ApiBearerAuth()
@Controller('support')
export class SupportController {
  constructor(
    private readonly supportService: SupportService,
    private readonly storageService: StorageService,
  ) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload an attachment for a support ticket' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  async uploadAttachment(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const url = await this.storageService.uploadFile(file, 'support-attachments');
    return {
      success: true,
      message: 'File uploaded successfully',
      url,
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
}
