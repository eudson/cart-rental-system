import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { RentalStatus, RentalType } from 'shared';

import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';

export class ListRentalsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => String)
  @IsEnum(RentalType)
  type?: RentalType;

  @IsOptional()
  @Type(() => String)
  @IsEnum(RentalStatus)
  status?: RentalStatus;

  @IsOptional()
  @Type(() => String)
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @Type(() => String)
  @IsUUID()
  cartId?: string;

  @IsOptional()
  @Type(() => String)
  @IsDateString()
  startDateFrom?: string;

  @IsOptional()
  @Type(() => String)
  @IsDateString()
  endDateTo?: string;
}
