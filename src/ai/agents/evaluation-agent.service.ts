import { Injectable } from '@nestjs/common';
import { AiService } from '../ai.service.js';

@Injectable()
export class EvaluationAgentService {
  constructor(private readonly ai: AiService) {}

  async feedback(prompt: string) {
    const result = await this.ai.generate(`Evaluate this learner submission. Return concise actionable feedback only.\n${prompt}`);
    return result ?? 'Your submission was evaluated against the challenge requirements. Review edge cases and keep the solution readable.';
  }
}