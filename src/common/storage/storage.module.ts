import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { CloudinaryService } from './providers/cloudinary.service';

@Global()
@Module({
  providers: [
    {
      provide: StorageService,
      useClass: CloudinaryService,
    },
  ],
  exports: [StorageService],
})
export class StorageModule { }
