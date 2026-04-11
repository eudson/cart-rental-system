import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CartStatus } from 'shared';

import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';

export class ListCartsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  locationId?: string;

  @IsOptional()
  @IsEnum(CartStatus)
  status?: CartStatus;
}
