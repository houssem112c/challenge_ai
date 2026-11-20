import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const users = await this.prisma.user.findMany({
      include: { submissions: true },
    });
    return users
      .map((user) => {
        const completed = user.submissions.filter((submission) => submission.status === 'COMPLETED');
        const score = completed.reduce((total, submission) => total + (submission.score ?? 0), 0);
        return {
          rank: 0,
          name: user.name,
          handle: `@${user.email.split('@')[0]}`,
          score: Math.round(score),
          solved: completed.length,
          trend: 0,
        };
      })
      .sort((a, b) => b.score - a.score)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  async listByChallenge(challengeId: string) {
    const submissions = await this.prisma.submission.findMany({
      where: { challengeId, status: 'COMPLETED' },
      include: { user: true },
      orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
    });
    return submissions.map((submission, index) => ({
      rank: index + 1,
      name: submission.user.name,
      handle: `@${submission.user.email.split('@')[0]}`,
      score: Math.round(submission.score ?? 0),
      solved: 1,
      trend: 0,
    }));
  }
}