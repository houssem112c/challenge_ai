import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ChallengesService } from '../challenges/challenges.service.js';
import { EvaluationAgentService } from '../ai/agents/evaluation-agent.service.js';
import { ExecutionService } from '../execution/execution.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ForbiddenException } from '@nestjs/common';
import type { JwtUser } from '../auth/jwt.guard.js';

export type SubmissionResult = {
  score: number;
  feedback: string;
  passed: boolean;
  testResults?: { passed: boolean; hidden?: boolean; actual?: unknown; expected?: unknown; error?: string }[];
};

@Injectable()
export class SubmissionsService {
  private readonly scores = new Map<string, number>();
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    private readonly challenges: ChallengesService,
    private readonly evaluation: EvaluationAgentService,
    private readonly execution: ExecutionService,
    private readonly prisma: PrismaService,
  ) {}

  async submit(
    challengeId: string,
    answer: string,
    language: 'javascript' | 'typescript' | 'python' = 'javascript',
    userId: string,
  ): Promise<SubmissionResult> {
    const existing = await this.prisma.submission.findUnique({
      where: { userId_challengeId: { userId, challengeId } },
      select: { id: true },
    });
    if (existing) throw new ConflictException('You have already submitted this challenge');

    const challenge = await this.challenges.getForSubmission(challengeId);
    if (!answer.trim()) throw new NotFoundException('Answer is required');

    let score = 0;
    let testResults: SubmissionResult['testResults'];

    if (challenge.type === 'PROGRAMMING') {
      testResults = [];
      const tests = challenge.tests ?? [];
      if (tests.length === 0) {
        const feedback = 'This challenge has no executable test cases. Regenerate it with test data before submitting.';
        await this.persist(challengeId, userId, answer, 0, false, feedback, testResults, challenge.tests);
        return {
          score: 0,
          passed: false,
          feedback,
          testResults,
        };
      }

      for (const test of tests) {
        try {
          const actual = await this.execution.run(language, answer, test.input, 'solution');
          testResults.push({
            passed: this.sameValue(actual, test.expected),
            hidden: test.hidden === true,
            actual: test.hidden ? undefined : actual,
            expected: test.hidden ? undefined : test.expected,
          });
        } catch (error) {
          testResults.push({
            passed: false,
            hidden: test.hidden === true,
            expected: test.hidden ? undefined : test.expected,
            error: error instanceof Error ? error.message : 'Execution failed',
          });
        }
      }

      score = Math.round(
        (testResults.filter((test) => test.passed).length / testResults.length) * 100,
      );
    } else if (challenge.type === 'QCM') {
      score = answer.trim().toLowerCase() === challenge.answer?.trim().toLowerCase() ? 100 : 0;
    } else {
      const prompt = `Challenge: ${challenge.title}
Mission: ${challenge.mission ?? challenge.description}
Evaluation criteria: ${challenge.evaluationCriteria?.join(', ') ?? 'technical accuracy, completeness, clarity'}
Learner answer:
${answer}

Score the answer from 0 to 100 and reply with JSON only:
{"score":75,"feedback":"specific feedback"}`

      if (process.env.GEMINI_API_KEY) {
        const result = await this.evaluation.feedback(prompt);
        try {
          const cleaned = result.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
          const parsed = JSON.parse(cleaned) as { score: number; feedback: string };
          score = Math.max(0, Math.min(100, Math.round(parsed.score)));
          const passed = score >= 60;
          this.scores.set(challengeId, Math.max(this.scores.get(challengeId) ?? 0, score));
          await this.persist(challengeId, userId, answer, score, passed, parsed.feedback, undefined, undefined);
          return { score, passed, feedback: parsed.feedback };
        } catch {
          // Fall through to the deterministic QA rubric.
        }
      }

      const contentLength = Math.min(answer.trim().length, 900);
      const criterionCount = challenge.evaluationCriteria?.length ?? 4;
      score = Math.round(Math.min(100, 20 + contentLength / 22 + criterionCount * 8));
    }

    const passed = score >= 60;
    this.scores.set(challengeId, Math.max(this.scores.get(challengeId) ?? 0, score));

    let feedback: string;
    if (challenge.type === 'PROGRAMMING') {
      const passedCount = testResults?.filter((test) => test.passed).length ?? 0;
      const total = testResults?.length ?? 0;
      feedback = `${passedCount}/${total} tests passed. ${
        passed
          ? 'Review the remaining edge cases to improve reliability.'
          : 'Compare each failing test input with the actual output and expected output.'
      }`;
      if (process.env.GEMINI_API_KEY) {
        feedback = await this.evaluation.feedback(`Challenge: ${challenge.title}
Score: ${score}/100
Passed tests: ${passedCount}/${total}
Results: ${JSON.stringify(testResults)}
Submission:
${answer}`);
      }
    } else if (challenge.type === 'QCM') {
      feedback = passed
        ? 'Correct. This answer matches the required concept.'
        : `Incorrect. The correct answer is: ${challenge.answer}`;
    } else {
      feedback = passed
        ? 'Your answer demonstrates understanding, but add concrete examples and edge-case analysis for a stronger response.'
        : 'Your answer needs more technical detail. Address the mission, include an example, and explain trade-offs or edge cases.';
    }

    await this.persist(challengeId, userId, answer, score, passed, feedback, testResults, challenge.tests);
    return { score, passed, feedback, testResults };
  }

  async getForLearner(challengeId: string, userId: string) {
    return this.prisma.submission.findUnique({
      where: { userId_challengeId: { userId, challengeId } },
      select: { score: true, feedback: true, status: true, testResults: true },
    });
  }

  async listForChallengeOwner(challengeId: string, user: JwtUser) {
    if (user.role !== 'COMPANY') throw new ForbiddenException('Only company accounts can review submissions');
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
      select: { creatorId: true },
    });
    if (!challenge || challenge.creatorId !== user.sub) throw new ForbiddenException('You do not own this challenge');
    return this.prisma.submission.findMany({
      where: { challengeId },
      include: { user: true, testResults: true },
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
    });
  }

  private async persist(
    challengeId: string,
    userId: string,
    answer: string,
    score: number,
    passed: boolean,
    feedback: string,
    testResults: SubmissionResult['testResults'],
    tests: { id?: string; input: unknown; expected: unknown }[] | undefined,
  ) {
    try {
    const submission = await this.prisma.submission.create({
      data: {
        userId,
        challengeId,
        answer,
        score,
        status: 'COMPLETED',
        feedback,
      },
    });

      if (testResults?.length) {
      await this.prisma.testResult.createMany({
        data: testResults.flatMap((result, index) => {
          const testCaseId = tests?.[index]?.id;
          if (!testCaseId) return [];
          return [{
            submissionId: submission.id,
            testCaseId,
            passed: result.passed,
            actual: result.actual === undefined ? undefined : JSON.parse(JSON.stringify(result.actual)),
            expected: result.expected === undefined ? undefined : JSON.parse(JSON.stringify(result.expected)),
          }];
        }),
      });
      }
      this.logger.log(`Submission saved: challenge=${challengeId}, score=${score}, user=${userId}`);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('You have already submitted this challenge');
      }
      this.logger.error(
        `Submission persistence failed: challenge=${challengeId}, user=${userId}, score=${score}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private sameValue(actual: unknown, expected: unknown): boolean {
    if (typeof actual === 'object' && typeof expected === 'object') {
      return JSON.stringify(this.normalise(actual)) === JSON.stringify(this.normalise(expected));
    }
    return Object.is(actual, expected);
  }

  private normalise(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.normalise(item));
    if (value && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>).sort().reduce<Record<string, unknown>>((result, key) => {
        result[key] = this.normalise((value as Record<string, unknown>)[key]);
        return result;
      }, {});
    }
    return value;
  }
}
