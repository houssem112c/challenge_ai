import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LoginDto, OAuthLoginDto, RefreshDto, SignupDto, VerifyOtpDto } from './dto/auth.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup') signup(@Body() body: SignupDto) { return this.auth.signup(body); }
  @Post('verify-otp') verifyOtp(@Body() body: VerifyOtpDto) { return this.auth.verifyOtp(body.email, body.otp); }
  @Post('login') login(@Body() body: LoginDto) { return this.auth.login(body.email, body.password); }
  @Post('refresh') refresh(@Body() body: RefreshDto) { return this.auth.refresh(body.refreshToken); }
  @Post('oauth') oauth(@Body() body: OAuthLoginDto) { return this.auth.oauthLogin(body); }
  @Post('logout')
  logout(@Body() body: RefreshDto) { return this.auth.logout(body.refreshToken); }
}
