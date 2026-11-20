import { Injectable } from '@nestjs/common';
import { AiService } from '../ai.service.js';

@Injectable()
export class ChallengeAgentService {

  constructor(private readonly ai: AiService) {}

  async createChallenge(data: {
    domain: string;
    topic: string;
    type: string;
    difficulty: string;
  }) {
    const typeName = data.type === 'PROGRAMMING' ? 'coding' : data.type === 'QCM' ? 'multiple-choice' : 'open-response';
    const prompt = `
You are a challenge-generation agent.

Create one original, high-quality ${typeName} challenge.

Domain:
${data.domain}

Topic:
${data.topic}

Difficulty:
${data.difficulty}

Return JSON only with this exact shape:
{
  "title": "specific title",
  "description": "2-4 sentences explaining the task, expected behavior, and constraints",
  "mission": "clear implementation or answer instructions",
  "examples": [{"input":"realistic input","output":"exact output"}],
  "starterCode": "complete starter code only for programming",
  "solution": "reference solution only for programming",
  "options": ["option 1","option 2","option 3","option 4"] only for QCM,
  "answer": "correct option text" only for QCM,
  "evaluationCriteria": ["criterion 1","criterion 2"],
  "tests": [{"input": {"example":"value"},"expected":"exact expected value"}],
  "hiddenTests": [{"input": {"example":"edge case"},"expected":"exact expected value"}]
}

Requirements:
- Be specific to ${data.domain} and ${data.topic}.
- Match ${data.difficulty} difficulty.
- Do not use placeholders such as "Example input".
- For programming challenges, include exactly 3 visible tests and exactly 9 additional hidden tests.
- Hidden tests must cover edge cases not shown in examples.
- Tests and hiddenTests must contain valid JSON values and directly verify the requirements.
- Do not wrap the JSON in markdown.
`;

    let result: string | undefined;
    try {
      result = await this.ai.generate(`${prompt}\nReturn JSON only.`);
    } catch {
      result = undefined;
    }
    if (result) {
      try {
        const cleaned = result.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
        return JSON.parse(cleaned);
      } catch {
        // Fall through to a deterministic local challenge when model output is malformed.
      }
    }
    return this.createFallback(data);
  }

  private createFallback(data: { domain: string; topic: string; type: string; difficulty: string }) {
    const topic = data.topic.trim();
    const domain = data.domain.trim();
    const lowerTopic = topic.toLowerCase();
    const lowerDomain = domain.toLowerCase();

    if (data.type === 'QCM') {
      return {
        title: `${topic} essentials`,
        description: `Test your understanding of ${topic} in ${domain}. Choose the answer that best describes the correct behavior or best practice.`,
        mission: `Select the statement that best demonstrates a correct understanding of ${topic}.`,
        examples: [{ input: 'A concept from the challenge', output: 'The correct option' }],
        options: [`The best implementation of ${topic}`, `A valid but incomplete approach`, `An approach that ignores ${topic}`, `An unrelated technique`],
        answer: `The best implementation of ${topic}`,
        evaluationCriteria: ['Concept accuracy', 'Recognition of best practice'],
        tests: [],
      };
    }

    if (data.type === 'QA') {
      return {
        title: `Explain ${topic}`,
        description: `In ${domain}, explain how ${topic} works, where it is useful, and how you would avoid its common failure modes.`,
        mission: `Write a structured answer that includes a definition, one realistic example, trade-offs, and edge cases related to ${topic}.`,
        examples: [{ input: 'A junior engineer asks for guidance', output: 'A clear explanation with example, trade-offs, and edge cases' }],
        evaluationCriteria: ['Technical accuracy', 'Clarity', 'Example quality', 'Edge-case coverage'],
        tests: [],
      };
    }

    if (lowerDomain.includes('machine learning') || lowerDomain.includes('data') || lowerTopic.includes('machine learning')) {
      return this.machineLearningFallback(topic, data.difficulty);
    }

    return {
      title: `${topic} in Practice`,
      description: `Create a reliable ${domain} solution for ${topic}. Your implementation should handle normal inputs, invalid inputs, and ${data.difficulty.toLowerCase() === 'hard' ? 'complex edge cases' : 'common edge cases'}.`,
      mission: `Implement a function named solution that accepts the input described below and returns the expected result. Include input validation and preserve the required data shape.`,
      examples: [{ input: '[1, 2, 3]', output: '[2, 4, 6]' }, { input: '[]', output: '[]' }],
      starterCode: `function solution(input) {\n  // Implement ${topic} here\n  // Handle arrays, invalid values, and empty input\n}\n\nmodule.exports = { solution };`,
      solution: `function solution(input) {\n  if (!Array.isArray(input)) throw new TypeError("input must be an array");\n  return input.map((value) => value * 2);\n}\n\nmodule.exports = { solution };`,
      evaluationCriteria: ['Correct behavior', 'Input validation', 'Edge-case handling', 'Readable implementation'],
      tests: [
        { input: [1, 2, 3], expected: [2, 4, 6] },
        { input: [], expected: [] },
        { input: [-2, 0, 5], expected: [-4, 0, 10] },
      ],
    };
  }

  private machineLearningFallback(topic: string, difficulty: string) {
    const title = difficulty.toUpperCase() === 'HARD' ? `Production ${topic} Pipeline` : `${topic} Predictor`;
    return {
      title,
      description: `Build a small ${topic} workflow that validates feature data, produces predictions or aggregates, and avoids leaking malformed input into later stages. This challenge focuses on the core mechanics rather than a full training library.`,
      mission: `Implement solution(features) using the supplied starter code. Validate that features is a non-empty array of numeric feature vectors, return each row's dot-product style score against the weights, and throw a descriptive error for inconsistent dimensions.`,
      examples: [{ input: '{ "weights": [1, 2], "features": [[3, 4], [5, 1]] }', output: '[11, 7]' }, { input: '{ "weights": [1], "features": [] }', output: '[]' }],
      starterCode: `function solution(input) {\n  // 1. Validate input.weights and input.features\n  // 2. Throw for invalid dimensions or non-numeric values\n  // 3. Compute one score per feature row\n}\n\nmodule.exports = { solution };`,
      solution: `function solution(input) {\n  if (!input || !Array.isArray(input.weights) || !Array.isArray(input.features)) throw new TypeError("weights and features must be arrays");\n  if (!input.weights.length) throw new Error("weights cannot be empty");\n  if (!input.weights.every(Number.isFinite)) throw new TypeError("weights must contain numbers");\n  return input.features.map((row) => {\n    if (!Array.isArray(row) || row.length !== input.weights.length || !row.every(Number.isFinite)) throw new TypeError("invalid feature row");\n    return row.reduce((score, value, index) => score + value * input.weights[index], 0);\n  });\n}\n\nmodule.exports = { solution };`,
      evaluationCriteria: ['Validates weights and feature rows', 'Handles empty feature lists', 'Rejects inconsistent dimensions', 'Returns numeric predictions'],
      tests: [
        { input: { weights: [1, 2], features: [[3, 4], [5, 1]] }, expected: [11, 7] },
        { input: { weights: [1], features: [] }, expected: [] },
        { input: { weights: [0.5, -1], features: [[2, 3]] }, expected: [-2] },
      ],
    };
  }
}