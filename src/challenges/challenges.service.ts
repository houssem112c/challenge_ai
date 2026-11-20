import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ChallengeAgentService } from '../ai/agents/challenge-agent.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ForbiddenException } from '@nestjs/common';
import type { JwtUser } from '../auth/jwt.guard.js';

export type ChallengeRecord = {
  id: string;
  title: string;
  description: string;
  domain: string;
  topic: string;
  type: 'PROGRAMMING' | 'QCM' | 'QA';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  estimatedMinutes: number;
  solved: number;
  rating: number;
  tags: string[];
  starterCode?: string;
  solution?: string;
  examples?: { input: string; output: string }[];
  options?: string[];
  answer?: string;
  mission?: string;
  evaluationCriteria?: string[];
  tests?: { id?: string; input: unknown; expected: unknown; hidden?: boolean }[];
};

@Injectable()
export class ChallengesService {
  private readonly logger = new Logger(ChallengesService.name);
  constructor(
    private readonly challengeAgent: ChallengeAgentService,
    private readonly prisma: PrismaService,
  ) {}

  async list() {
    const records = await this.prisma.challenge.findMany({
      include: { tests: true, creator: true },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((record) => ({
      ...this.toPublicRecord(record),
      creatorName: record.creator?.name,
      creatorEmail: record.creator?.email,
    }));
  }

  async listMine(user: JwtUser) {
    if (user.role !== 'COMPANY') throw new ForbiddenException('Only company accounts can view this list');
    const records = await this.prisma.challenge.findMany({
      where: { creatorId: user.sub },
      include: { tests: true, creator: true },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((record) => ({
      ...this.toPublicRecord(record),
      creatorName: record.creator?.name,
      creatorEmail: record.creator?.email,
    }));
  }

  async get(id: string) {
    const record = await this.prisma.challenge.findUnique({
      where: { id },
      include: { tests: true },
    });
    if (!record) throw new NotFoundException('Challenge not found');
    return this.toPublicRecord(record);
  }
  async getForSubmission(id: string) {
    const record = await this.prisma.challenge.findUnique({
      where: { id },
      include: { tests: true },
    });
    if (!record) throw new NotFoundException('Challenge not found');
    return this.toRecord(record);
  }
  async generate(input: { domain: string; topic: string; type: string; difficulty: string }, user: JwtUser) {
    if (user.role !== 'COMPANY') throw new ForbiddenException('Only company accounts can create challenges');
    const drafts: ChallengeRecord[] = [];
    for (let index = 0; index < 3; index++) {
      try {
        drafts.push(await this.createDraft(input, index));
      } catch (error) {
        this.logger.error(`Challenge draft ${index + 1} generation failed`, error instanceof Error ? error.stack : String(error));
      }
    }
    if (drafts.length === 0) {
      drafts.push(await this.createDraft(input, 0));
    }
    return drafts;
  }

  private async createDraft(input: { domain: string; topic: string; type: string; difficulty: string }, index: number): Promise<ChallengeRecord> {
    try {
      const generated = await this.challengeAgent.createChallenge(input);
      const visible = generated.tests ?? [];
      const hidden = generated.hiddenTests ?? this.buildHiddenTests(visible);
      return {
        id: `draft-${Date.now()}-${index}`,
        title: `${generated.title}${index > 0 ? ` — Option ${index + 1}` : ''}`,
        description: generated.description,
        domain: input.domain,
        topic: input.topic,
        type: input.type as ChallengeRecord['type'],
        difficulty: input.difficulty as ChallengeRecord['difficulty'],
        estimatedMinutes: 20,
        solved: 0,
        rating: 0,
        tags: [input.topic, input.domain],
        starterCode: generated.starterCode,
        solution: generated.solution,
        examples: generated.examples,
        mission: generated.mission,
        evaluationCriteria: generated.evaluationCriteria,
        options: generated.options,
        answer: generated.answer,
        tests: [
          ...visible.map((test: { input: unknown; expected: unknown }) => ({ ...test, hidden: false })),
          ...hidden.map((test: { input: unknown; expected: unknown }) => ({ ...test, hidden: true })),
        ],
      };
    } catch (error) {
      this.logger.error(
        `Challenge generation failed for topic="${input.topic}", domain="${input.domain}", type="${input.type}"`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async saveDraft(draft: ChallengeRecord, user: JwtUser) {
    if (user.role !== 'COMPANY') throw new ForbiddenException('Only company accounts can publish challenges');
    const creator = await this.prisma.user.findUnique({ where: { id: user.sub } });
    if (!creator) throw new ForbiddenException('Company account not found');
    const record = await this.prisma.challenge.create({
      data: {
        creatorId: creator.id,
        title: draft.title,
        description: draft.description,
        domain: draft.domain,
        topic: draft.topic,
        type: draft.type,
        difficulty: draft.difficulty,
        starterCode: draft.starterCode,
        solution: draft.solution,
        mission: draft.mission,
        examples: draft.examples ? JSON.parse(JSON.stringify(draft.examples)) : undefined,
        options: draft.options ? JSON.parse(JSON.stringify(draft.options)) : undefined,
        answer: draft.answer,
        evaluationCriteria: draft.evaluationCriteria ? JSON.parse(JSON.stringify(draft.evaluationCriteria)) : undefined,
        tests: {
          create: (draft.tests ?? []).map((test) => ({
            input: JSON.parse(JSON.stringify(test.input)),
            expected: JSON.parse(JSON.stringify(test.expected)),
            hidden: test.hidden === true,
          })),
        },
      },
      include: { tests: true },
    });
    this.logger.log(`Challenge published in database: ${record.id} (${record.title})`);
    return this.toPublicRecord(record);
  }

  private buildHiddenTests(visible: { input: unknown; expected: unknown }[]) {
    return Array.from({ length: 9 }, (_, index) => {
      const source = visible[index % Math.max(visible.length, 1)];
      if (source && Array.isArray(source.input) && Array.isArray(source.expected)) {
        const input = source.input.map((value) => typeof value === 'number' ? value + (index + 2) * 10 : value);
        const expected = source.expected.map((value) => typeof value === 'number' ? value + (index + 2) * 10 : value);
        return { input, expected };
      }
      if (source && typeof source.input === 'object' && source.input !== null) {
        return {
          input: { ...source.input as Record<string, unknown>, hiddenCase: index + 1 },
          expected: source.expected,
        };
      }
      return { input: { hiddenCase: index + 1 }, expected: source?.expected ?? null };
    });
  }

  private toRecord(record: {
    id: string;
    title: string;
    description: string;
    domain: string;
    topic: string;
    type: string;
    difficulty: string;
    starterCode: string | null;
    solution?: string | null;
    mission?: string | null;
    examples?: unknown;
    options?: unknown;
    answer?: string | null;
    evaluationCriteria?: unknown;
    tests: { id: string; input: unknown; expected: unknown; hidden: boolean }[];
  }): ChallengeRecord {
    const examples = Array.isArray(record.examples)
      ? record.examples as { input: string; output: string }[]
      : undefined;
    const options = Array.isArray(record.options) ? record.options as string[] : undefined;
    return {
      id: record.id,
      title: record.title,
      description: record.description,
      domain: record.domain,
      topic: record.topic,
      type: record.type as ChallengeRecord['type'],
      difficulty: record.difficulty as ChallengeRecord['difficulty'],
      estimatedMinutes: 20,
      solved: 0,
      rating: 0,
      tags: [record.topic, record.domain],
      starterCode: record.starterCode ?? undefined,
      solution: record.solution ?? undefined,
      mission: record.mission ?? undefined,
      examples,
      options,
      answer: record.answer ?? undefined,
      evaluationCriteria: Array.isArray(record.evaluationCriteria) ? record.evaluationCriteria as string[] : undefined,
      tests: record.tests.map((test) => ({ id: test.id, input: test.input, expected: test.expected, hidden: ('hidden' in test ? test.hidden : false) })),
    };
  }

  private toPublicRecord(record: {
    id: string;
    title: string;
    description: string;
    domain: string;
    topic: string;
    type: string;
    difficulty: string;
    starterCode: string | null;
    solution?: string | null;
    mission?: string | null;
    examples?: unknown;
    options?: unknown;
    answer?: string | null;
    evaluationCriteria?: unknown;
    tests: { id: string; input: unknown; expected: unknown; hidden: boolean }[];
  }): ChallengeRecord {
    const publicRecord = this.toRecord(record);
    return {
      ...publicRecord,
      solution: undefined,
      tests: publicRecord.tests?.filter((_, index) => !record.tests[index]?.hidden),
    };
  }
}