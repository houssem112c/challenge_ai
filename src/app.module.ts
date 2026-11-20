import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ChallengesModule } from './challenges/challenges.module.js';
import { SubmissionsModule } from './submissions/submissions.module.js';
import { LeaderboardModule } from './leaderboard/leaderboard.module.js';
import { AiModule } from './ai/ai.module.js';
import { ExecutionModule } from './execution/execution.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';

@Module({
  imports: [PrismaModule, AuthModule, AiModule, ExecutionModule, ChallengesModule, SubmissionsModule, LeaderboardModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
