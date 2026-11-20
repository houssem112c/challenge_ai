import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ChallengesService } from './challenges.service.js';
import { GeneratedChallengeDto } from './dto/generate-challenge.dto.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import type { JwtUser } from '../auth/jwt.guard.js';
import type { Request } from 'express';

@Controller('challenges')
export class ChallengesController {
  constructor(private readonly service: ChallengesService) {}
  @Get()
  list() { return this.service.list(); }
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  mine(@Req() request: Request & { user: JwtUser }) {
    return this.service.listMine(request.user);
  }
  @Get(':id')
  get(@Param('id') id: string) { return this.service.get(id); }
  @Post('generate')
  @UseGuards(JwtAuthGuard)
  generate(@Req() request: Request & { user: JwtUser }, @Body() body: GeneratedChallengeDto) {
    return this.service.generate(body, request.user);
  }
  @Post('save')
  @UseGuards(JwtAuthGuard)
  save(@Req() request: Request & { user: JwtUser }, @Body() body: unknown) {
    return this.service.saveDraft(body as never, request.user);
  }
}