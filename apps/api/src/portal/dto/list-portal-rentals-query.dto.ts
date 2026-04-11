import { Type } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';
import { RentalStatus, RentalType } from 'shared';

import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';

export class ListPortalRentalsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => String)
  @IsEnum(RentalType)
  type?: RentalType;

  @IsOptional()
  @Type(() => String)
  @IsEnum(RentalStatus)
  status?: RentalStatus;
}
