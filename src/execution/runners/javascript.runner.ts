import { Injectable } from '@nestjs/common';
import vm from 'node:vm';

@Injectable()
export class JavascriptRunner {
  run(code: string, functionName: string, input: unknown) {
    const sandbox: Record<string, unknown> = { module: { exports: {} }, exports: {}, result: undefined, console };
    sandbox.exports = (sandbox.module as { exports: unknown }).exports;
    const context = vm.createContext(sandbox);
    const script = new vm.Script(`result = (async () => { ${code}; const exported = (module && module.exports) || {}; const fn = (typeof ${functionName} === 'function') ? ${functionName} : exported.${functionName}; if (typeof fn !== 'function') throw new Error('Expected function ${functionName}'); return await fn(${JSON.stringify(input)}); })()`);
    const value = script.runInContext(context, { timeout: 1000 }) as Promise<unknown>;
    return Promise.race([value, new Promise((_, reject) => setTimeout(() => reject(new Error('Execution timed out')), 1100))]);
  }
}