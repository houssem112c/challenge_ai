import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum AccountRoleDto {
  USER = 'USER',
  COMPANY = 'COMPANY',
}

export class SignupDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(AccountRoleDto)
  role!: AccountRoleDto;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class VerifyOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  otp!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class OAuthLoginDto {
  @IsString()
  provider!: string;

  @IsString()
  subject!: string;

  @IsEmail()
  email!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsEnum(AccountRoleDto)
  role?: AccountRoleDto;
}
