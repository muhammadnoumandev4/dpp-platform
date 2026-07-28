import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

export class CreateInvitationDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;

  @IsIn([Role.MANAGER, Role.EDITOR])
  role: Role;
}

export class AcceptInvitationDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(8)
  password: string;
}
