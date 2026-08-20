import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { NannyDocumentService } from './nanny-document.service';

@ApiTags("Documents / Nanny's Documents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents/nannies')
export class NannyDocumentController {
  constructor(private readonly nannyDocumentService: NannyDocumentService) {}

  @Get()
  @ApiOperation({
    summary: "Screen 2: Get assigned nannies' verified documents by Parent / Child ID",
    description:
      'Fetches assigned nannies for parent children (Deepa Sanjana, Sanjana Kumari, Priya Das) and their verified documents.',
  })
  @ApiQuery({ name: 'childId', required: false, description: 'Optional filter by specific Child ID' })
  getAssignedNanniesDocuments(
    @CurrentUser() user: CurrentUserPayload,
    @Query('childId') childId?: string,
  ) {
    return this.nannyDocumentService.getAssignedNanniesDocuments(user.userId, childId);
  }

  @Get(':nannyUserId')
  @ApiOperation({
    summary: 'Screen 2: Get verified documents for a specific assigned nanny by Nanny User ID',
    description: 'Retrieves documents list for a single assigned nanny by Nanny User ID.',
  })
  @ApiParam({ name: 'nannyUserId', description: 'Nanny User ID' })
  getNannyDocumentsById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('nannyUserId') nannyUserId: string,
  ) {
    return this.nannyDocumentService.getNannyDocumentsById(
      user.userId,
      nannyUserId,
    );
  }
}
