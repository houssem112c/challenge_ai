-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN     "answer" TEXT,
ADD COLUMN     "evaluationCriteria" JSONB,
ADD COLUMN     "examples" JSONB,
ADD COLUMN     "mission" TEXT,
ADD COLUMN     "options" JSONB;
