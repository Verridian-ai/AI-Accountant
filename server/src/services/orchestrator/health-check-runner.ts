/**
 * Health Check Runner
 *
 * Executes health check probes against Python agent processes
 * by spawning them with --health-check flag.
 */

import { spawn } from 'child_process';
import type { HealthCheckResult } from './health-types.js';

/**
 * Run a health check against an agent process
 */
export function runHealthCheckProcess(
  scriptPath: string,
  checkTimeoutMs: number,
): Promise<HealthCheckResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    let isResolved = false;
    let healthCheckProcess: ReturnType<typeof spawn> | null = null;

    const safeResolve = (result: HealthCheckResult) => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timeoutHandle);
      resolve(result);
    };

    const timeoutHandle = setTimeout(() => {
      if (healthCheckProcess && !healthCheckProcess.killed) {
        healthCheckProcess.kill('SIGKILL');
      }
      safeResolve({
        healthy: false,
        responseTimeMs: checkTimeoutMs,
        error: 'Health check timed out',
      });
    }, checkTimeoutMs);

    healthCheckProcess = spawn('python', [scriptPath, '--health-check']);

    let stdout = '';
    let stderr = '';

    healthCheckProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    healthCheckProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    healthCheckProcess.on('close', (code) => {
      const responseTimeMs = Date.now() - startTime;

      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          safeResolve({
            healthy: result.healthy !== false,
            responseTimeMs,
            version: result.version,
            details: result,
          });
        } catch {
          safeResolve({
            healthy: true,
            responseTimeMs,
          });
        }
      } else {
        safeResolve({
          healthy: false,
          responseTimeMs,
          error: stderr || `Process exited with code ${code}`,
        });
      }
    });

    healthCheckProcess.on('error', (error) => {
      safeResolve({
        healthy: false,
        responseTimeMs: Date.now() - startTime,
        error: error.message,
      });
    });
  });
}
