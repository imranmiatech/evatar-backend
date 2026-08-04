import { Module } from '@nestjs/common';
import { AdminRecipeController } from './controllers/admin-recipe.controller';
import { AdminRecipeService } from './services/admin-recipe.service';
import { StorageModule } from '../../../common/storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [AdminRecipeController],
  providers: [AdminRecipeService],
})
export class AdminRecipeModule {}
