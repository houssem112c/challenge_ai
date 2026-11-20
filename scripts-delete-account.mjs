import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const email = 'housembenmabrouk12@gmail.com';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, email: true },
    });
    if (!user) return { found: false, deletedSubmissions: 0 };

    const submissions = await tx.submission.deleteMany({ where: { userId: user.id } });
    await tx.user.delete({ where: { id: user.id } });
    return { found: true, email: user.email, deletedSubmissions: submissions.count };
  });
  console.log(JSON.stringify(result));
} finally {
  await prisma.$disconnect();
  await pool.end();
}
