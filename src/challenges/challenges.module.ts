import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { ChallengesController } from './challenges.controller.js';
import { ChallengesService } from './challenges.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/jwt.guard.js';

@Module({
  imports: [PrismaModule, AiModule, JwtModule.register({})],
  controllers: [ChallengesController],
  providers: [ChallengesService, JwtAuthGuard],
  exports: [ChallengesService],
})
export class ChallengesModule {}