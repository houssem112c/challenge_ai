import { Module } from '@nestjs/common';
import { ChallengesModule } from '../challenges/challenges.module.js';
import { AiModule } from '../ai/ai.module.js';
import { ExecutionModule } from '../execution/execution.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SubmissionsController } from './submissions.controller.js';
import { SubmissionsService } from './submissions.service.js';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/jwt.guard.js';

@Module({
  imports: [PrismaModule, ChallengesModule, AiModule, ExecutionModule, JwtModule.register({})],
  controllers: [SubmissionsController],
  providers: [SubmissionsService, JwtAuthGuard],
})
export class SubmissionsModule {}