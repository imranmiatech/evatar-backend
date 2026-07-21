import { HttpStatus } from '@nestjs/common';
import { IPaginationMeta } from '../interceptors/response.interceptor';

export class ResponseHelper {
  static success<T>(data: T, message = 'Success', statusCode = HttpStatus.OK) {
    return { success: true, statusCode, message, data };
  }

  static created<T>(data: T, message = 'Created successfully') {
    return this.success(data, message, HttpStatus.CREATED);
  }

  static paginated<T>(
    data: T[],
    meta: IPaginationMeta,
    message = 'Data retrieved successfully',
  ) {
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message,
      data,
      meta,
    };
  }

  static noContent(message = 'Deleted successfully') {
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message,
      data: null,
    };
  }

  static buildPaginationMeta(
    total: number,
    page: number,
    limit: number,
  ): IPaginationMeta {
    const totalPages = Math.ceil(total / limit);
    return {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }
}
