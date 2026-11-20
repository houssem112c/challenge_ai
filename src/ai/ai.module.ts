import { Module } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { ChallengeAgentService } from './agents/challenge-agent.service.js';
import { EvaluationAgentService } from './agents/evaluation-agent.service.js';

@Module({
  providers: [AiService, ChallengeAgentService, EvaluationAgentService],
  exports: [AiService, ChallengeAgentService, EvaluationAgentService],
})
export class AiModule {}