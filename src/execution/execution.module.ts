import { Module } from '@nestjs/common';
import { ExecutionService } from './execution.service.js';
import { JavascriptRunner } from './runners/javascript.runner.js';
import { PythonRunner } from './runners/python.runner.js';
import { TypescriptRunner } from './runners/typescript.runner.js';

@Module({ providers: [ExecutionService, JavascriptRunner, PythonRunner, TypescriptRunner], exports: [ExecutionService] })
export class ExecutionModule {}