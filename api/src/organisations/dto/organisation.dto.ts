import { IsEmail, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateOrganisationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  logoUrl?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-f]{6}$/i, { message: 'accentColor must be a six-digit hex colour such as #14654A' })
  accentColor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  contactEmail?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  website?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string | null;
}
