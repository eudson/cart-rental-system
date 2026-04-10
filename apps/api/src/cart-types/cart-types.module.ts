import { Module } from '@nestjs/common';

import { CartTypesController } from './cart-types.controller';
import { CartTypesService } from './cart-types.service';

@Module({
  controllers: [CartTypesController],
  providers: [CartTypesService],
})
export class CartTypesModule {}
