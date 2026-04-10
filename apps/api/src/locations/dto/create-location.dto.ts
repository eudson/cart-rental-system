import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LocationStatus } from 'shared';

export class CreateLocationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  timezone?: string;

  @IsOptional()
  @IsEnum(LocationStatus)
  status?: LocationStatus;
}
