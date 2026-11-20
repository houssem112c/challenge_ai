import { Controller, Get, Param } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service.js';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly service: LeaderboardService) {}
  @Get()
  list() { return this.service.list(); }
  @Get('challenge/:challengeId')
  byChallenge(@Param('challengeId') challengeId: string) { return this.service.listByChallenge(challengeId); }
}