import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class AiService {
  private readonly ai: GoogleGenAI;
  private readonly logger = new Logger(AiService.name);
  private availableModel?: string;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });
  }

  async generate(prompt: string): Promise<string | undefined> {
    if (!process.env.GEMINI_API_KEY) return undefined;
    const model = await this.resolveModel();
    if (!model) return undefined;
    try {
      const response = await this.ai.models.generateContent({
        model,
        contents: prompt,
      });
      this.logger.log(`Gemini response generated with model="${model}"`);
      return response.text;
    } catch (error) {
      this.logger.error(
        `Gemini request failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return undefined;
    }
  }

  private async resolveModel(): Promise<string | undefined> {
    if (this.availableModel) return this.availableModel;

    const candidates = [
      'gemini-3.8-flash',
      'gemini-3-flash-preview',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ];

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(process.env.GEMINI_API_KEY ?? '')}`,
      );
      if (!response.ok) {
        throw new Error(`Model discovery returned HTTP ${response.status}`);
      }
      const payload = await response.json() as {
        models?: { name?: string; supportedGenerationMethods?: string[] }[];
      };
      const models = payload.models ?? [];
      for (const candidate of candidates) {
        const found = models.find((model) =>
          model.name?.endsWith(`/${candidate}`)
          && model.supportedGenerationMethods?.includes('generateContent'),
        );
        if (found?.name) {
          this.availableModel = found.name.split('/').pop();
          this.logger.log(`Selected available Gemini model="${this.availableModel}"`);
          return this.availableModel;
        }
      }
    } catch (error) {
      this.logger.warn(
        `Gemini model discovery failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    this.logger.error(
      `No Gemini model supporting generateContent was found. Tried: ${candidates.join(', ')}`,
    );
    return undefined;
  }
}