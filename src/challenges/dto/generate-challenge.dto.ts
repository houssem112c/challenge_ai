import { IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';

enum ChallengeTypeDto {
  PROGRAMMING = 'PROGRAMMING',
  QCM = 'QCM',
  QA = 'QA',
}

enum DifficultyDto {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

export class GeneratedChallengeDto {
  @IsString()
  @IsNotEmpty()
  domain!: string;

  @IsString()
  @MinLength(2)
  topic!: string;

  @IsEnum(ChallengeTypeDto)
  type!: ChallengeTypeDto;

  @IsEnum(DifficultyDto)
  difficulty!: DifficultyDto;

}