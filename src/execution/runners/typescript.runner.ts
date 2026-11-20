import { Injectable } from '@nestjs/common';
import { JavascriptRunner } from './javascript.runner.js';

@Injectable()
export class TypescriptRunner {
  constructor(private readonly javascript: JavascriptRunner) {}
  run(code: string, functionName: string, input: unknown) {
    const normalized = code.replace(/:\s*[A-Za-z_$][\w$<>[\]| ]*/g, '').replace(/\s+as\s+[A-Za-z_$][\w$<>[\]| ]*/g, '');
    return this.javascript.run(normalized, functionName, input);
  }
}