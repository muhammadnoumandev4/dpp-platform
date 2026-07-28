import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProductStatus } from '@prisma/client';

export class MaterialDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsNumber()
  @Min(0.1)
  @Max(100)
  percentage: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  countryOfOriginId?: string;

  @IsOptional()
  @IsBoolean()
  recyclable?: boolean;
}

export class SustainabilityDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  carbonFootprintKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  waterConsumptionL?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  recycledPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  repairabilityScore?: number;

  @IsOptional()
  @IsBoolean()
  recyclable?: boolean;
}

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  sku: string;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  serialNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsDateString()
  productionDate?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  countryOfOriginId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialDto)
  materials?: MaterialDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => SustainabilityDto)
  sustainability?: SustainabilityDto;
}

export class ListProductsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class AddImageDto {
  @IsString()
  key: string;

  @IsOptional()
  @IsBoolean()
  isCover?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  altText?: string;
}

export class AddCertificationDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  issuingAuthority?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  fileKey?: string;

  @IsOptional()
  @IsString()
  fileName?: string;
}

export class AddDocumentDto {
  @IsIn(['MANUAL', 'WARRANTY', 'DATASHEET'])
  type: 'MANUAL' | 'WARRANTY' | 'DATASHEET';

  @IsString()
  fileKey: string;

  @IsString()
  fileName: string;

  @IsInt()
  @Min(1)
  sizeBytes: number;
}
