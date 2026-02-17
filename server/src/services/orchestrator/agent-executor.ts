/**
 * Agent Process Executor
 *
 * Handles spawning and managing Python agent subprocesses
 * with timeout management and abort controller support.
 */

import { spawn, ChildProcess } from 'child_process';
import type { AgentRequest, AgentConfig, AgentError } from './types.js';
import { AgentExecutionResult, createAgentError } from './orchestrator-types.js';

/**
 * Execute a Python agent process with timeout and abort support
 */
export function executeAgentProcess(
  request: AgentRequest,
  config: AgentConfig,
  timeoutMs: number,
  activeRequests: Map<string, AbortController>,
): Promise<AgentExecutionResult> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    activeRequests.set(request.requestId, controller);
    let isSettled = false;
    let pythonProcess: ChildProcess | null = null;

    const cleanup = () => {
      activeRequests.delete(request.requestId);
    };

    const safeReject = (error: AgentError) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      reject(error);
    };

    const safeResolve = (result: AgentExecutionResult) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      resolve(result);
    };

    // Set up timeout with explicit process kill
    const timeoutId = setTimeout(() => {
      if (pythonProcess && !pythonProcess.killed) {
        pythonProcess.kill('SIGKILL');
      }
      controller.abort();
      safeReject(createAgentError('TIMEOUT', `Agent execution timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    // Prepare input for Python agent
    const input = JSON.stringify({
      query: request.query,
      userId: request.userId,
      context: request.context,
      requestId: request.requestId,
    });

    // Spawn Python process
    pythonProcess = spawn('python', [config.scriptPath], {
      env: {
        ...process.env,
        AGENT_INPUT: input,
      },
      signal: controller.signal,
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      clearTimeout(timeoutId);

      if (isSettled) return;

      if (code !== 0) {
        safeReject(
          createAgentError('PROCESS_CRASHED', `Agent process exited with code ${code}: ${stderr}`),
        );
        return;
      }

      try {
        const result = JSON.parse(stdout);
        safeResolve({
          content: result.content || result.response || '',
          data: result.data,
          toolCalls: result.toolCalls,
          agentTimeMs: result.executionTimeMs || 0,
          modelUsed: result.modelUsed,
          tokenUsage: result.tokenUsage,
          agentVersion: result.version,
        });
      } catch (parseError) {
        safeReject(
          createAgentError('INVALID_RESPONSE', `Failed to parse agent response: ${parseError}`),
        );
      }
    });

    pythonProcess.on('error', (error) => {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        safeReject(createAgentError('TIMEOUT', 'Agent execution was cancelled'));
      } else {
        safeReject(createAgentError('PROCESS_CRASHED', error.message));
      }
    });

    // Send input via stdin
    pythonProcess.stdin?.write(input);
    pythonProcess.stdin?.end();
  });
}
