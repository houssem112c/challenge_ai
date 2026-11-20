import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

type AuthResult = { accessToken: string; refreshToken: string; user: { id: string; name: string; email: string; role: string } };

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async signup(input: { name: string; email: string; password: string; role: 'USER' | 'COMPANY' }): Promise<{ message: string }> {
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('An account already exists with this email');
    const otp = crypto.randomInt(100000, 999999).toString();
    await this.prisma.user.create({
      data: {
        name: input.name,
        email,
        passwordHash: await bcrypt.hash(input.password, 12),
        role: input.role,
        otpCode: otp,
        otpExpires: new Date(Date.now() + 10 * 60 * 1000),
        emailVerified: false,
      },
    });
    await this.sendOtp(email, otp);
    return { message: 'Account created. Enter the OTP sent to your email.' };
  }

  async verifyOtp(email: string, otp: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || user.otpCode !== otp || !user.otpExpires || user.otpExpires.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired OTP');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, otpCode: null, otpExpires: null },
    });
    return this.issueTokens({ id: user.id, name: user.name, email: user.email, role: user.role });
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user?.passwordHash || !await bcrypt.compare(password, user.passwordHash)) throw new UnauthorizedException('Invalid email or password');
    if (!user.emailVerified) throw new UnauthorizedException('Email verification is required');
    return this.issueTokens({ id: user.id, name: user.name, email: user.email, role: user.role });
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'change-this-refresh-secret',
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user?.refreshTokenHash) throw new UnauthorizedException();
      if (!await bcrypt.compare(refreshToken, user.refreshTokenHash)) throw new UnauthorizedException();
      return this.issueTokens({ id: user.id, name: user.name, email: user.email, role: user.role });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
  }

  async oauthLogin(input: { provider: string; subject: string; email: string; name: string; role?: 'USER' | 'COMPANY' }): Promise<AuthResult> {
    const email = input.email.toLowerCase();
    let user = await this.prisma.user.findFirst({
      where: { oauthProvider: input.provider, oauthSubject: input.subject },
    });
    if (!user) {
      user = await this.prisma.user.upsert({
        where: { email },
        update: { oauthProvider: input.provider, oauthSubject: input.subject, emailVerified: true },
        create: { name: input.name, email, role: input.role ?? 'USER', oauthProvider: input.provider, oauthSubject: input.subject, emailVerified: true },
      });
    }
    return this.issueTokens({ id: user.id, name: user.name, email: user.email, role: user.role });
  }

  async logout(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'change-this-refresh-secret',
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { refreshTokenHash: true },
      });
      if (user?.refreshTokenHash && await bcrypt.compare(refreshToken, user.refreshTokenHash)) {
        await this.prisma.user.update({
          where: { id: payload.sub },
          data: { refreshTokenHash: null },
        });
      }
    } catch {
      // Local logout must still succeed even if the refresh token is invalid or expired.
    }
    return { message: 'Logged out' };
  }

  private async issueTokens(user: { id: string; name: string; email: string; role: string }): Promise<AuthResult> {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET ?? 'change-this-access-secret',
      expiresIn: '15m',
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET ?? 'change-this-refresh-secret',
      expiresIn: '30d',
    });
    await this.prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: await bcrypt.hash(refreshToken, 10) } });
    return { accessToken, refreshToken, user };
  }

  private async sendOtp(email: string, otp: string) {
    if (!process.env.SMTP_HOST) {
      console.log(`[OTP] ${email}: ${otp}`);
      return;
    }
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: email,
      subject: 'Verify your CodeQuest account',
      text: `Your CodeQuest verification code is ${otp}. It expires in 10 minutes.`,
      html: `<p>Your CodeQuest verification code is <b>${otp}</b>.</p><p>It expires in 10 minutes.</p>`,
    });
  }
}
