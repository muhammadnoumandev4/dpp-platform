import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterBrandDto } from './dto/auth.dto';
import { CurrentUser } from './current-user.decorator';
import { ACCESS_COOKIE, AuthenticatedUser } from './auth.types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setAccessCookie(response: Response, accessToken: string) {
    response.cookie(ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(dto);
    this.setAccessCookie(response, result.accessToken);
    return { user: result.user };
  }

  @Post('register-brand')
  @HttpCode(201)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a brand and its tenant user account' })
  async registerBrand(@Body() dto: RegisterBrandDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.registerBrand(dto);
    this.setAccessCookie(response, result.accessToken);
    return { user: result.user };
  }

  @Get('me')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'))
  async me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(ACCESS_COOKIE, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      path: '/',
    });
  }
}
