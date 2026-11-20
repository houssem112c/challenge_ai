import { Injectable } from '@nestjs/common';
import { JavascriptRunner } from './runners/javascript.runner.js';
import { PythonRunner } from './runners/python.runner.js';
import { TypescriptRunner } from './runners/typescript.runner.js';

@Injectable()
export class ExecutionService {
  constructor(
    private readonly javascript: JavascriptRunner,
    private readonly typescript: TypescriptRunner,
    private readonly python: PythonRunner,
  ) {}

  run(language: 'javascript' | 'typescript' | 'python', code: string, input: unknown, functionName = 'solution') {
    if (language === 'python') return this.python.run(code, input);
    if (language === 'typescript') return this.typescript.run(code, functionName, input);
    return this.javascript.run(code, functionName, input);
  }
}