import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { SubmitChallengeDto } from './dto/submit-challenge.dto.js';
import { SubmissionsService } from './submissions.service.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import type { JwtUser } from '../auth/jwt.guard.js';
import type { Request } from 'express';

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly service: SubmissionsService) {}
  @Post()
  @UseGuards(JwtAuthGuard)
  async submit(@Req() request: Request & { user: JwtUser }, @Body() body: SubmitChallengeDto) {
    return this.service.submit(body.challengeId, body.answer, body.language, request.user.sub);
  }
  @Get('challenge/:challengeId/mine')
  @UseGuards(JwtAuthGuard)
  mine(@Req() request: Request & { user: JwtUser }, @Param('challengeId') challengeId: string) {
    return this.service.getForLearner(challengeId, request.user.sub);
  }
  @Get('challenge/:challengeId')
  @UseGuards(JwtAuthGuard)
  forChallenge(@Req() request: Request & { user: JwtUser }, @Param('challengeId') challengeId: string) {
    return this.service.listForChallengeOwner(challengeId, request.user);
  }
}