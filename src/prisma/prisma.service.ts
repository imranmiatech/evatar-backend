import 'dotenv/config';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createPrismaClientOptions } from './prisma-client-options';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super(createPrismaClientOptions() as any);
  }

  async onModuleInit() {
    await this.$connect();
    console.log('Connected to database');
    console.log(`localhost URL: http://localhost:${process.env.PORT}/api/docs`);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
