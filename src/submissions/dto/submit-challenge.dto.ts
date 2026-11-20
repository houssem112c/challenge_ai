import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SubmitChallengeDto {
  @IsString()
  @IsNotEmpty()
  challengeId!: string;

  @IsString()
  @IsNotEmpty()
  answer!: string;

  @IsOptional()
  @IsString()
  language?: 'javascript' | 'typescript' | 'python';
}