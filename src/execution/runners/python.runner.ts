import { Injectable } from '@nestjs/common';
import { spawn } from 'node:child_process';

@Injectable()
export class PythonRunner {
  run(code: string, input: unknown) {
    return new Promise<unknown>((resolve, reject) => {
      const process = spawn('python', ['-c', `${code}\nimport json\nprint(json.dumps(main(json.loads(input_data))) if 'main' in globals() else json.dumps(None))`], { windowsHide: true });
      let output = '';
      let error = '';
      process.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
      process.stderr.on('data', (chunk: Buffer) => { error += chunk.toString(); });
      process.on('error', reject);
      process.on('close', (status) => {
        if (status !== 0) reject(new Error(error || 'Python execution failed'));
        else {
          try { resolve(JSON.parse(output.trim())); } catch { reject(new Error('Python returned invalid JSON')); }
        }
      });
      process.stdin.write(`input_data = ${JSON.stringify(JSON.stringify(input))}\n`);
      process.stdin.end();
      setTimeout(() => { process.kill(); reject(new Error('Execution timed out')); }, 1100);
    });
  }
}