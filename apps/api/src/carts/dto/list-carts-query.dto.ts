import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { CartStatus } from 'shared';

import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';

export class ListCartsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => String)
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsEnum(CartStatus)
  status?: CartStatus;
}
