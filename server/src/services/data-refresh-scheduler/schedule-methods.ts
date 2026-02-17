/**
 * Schedule Methods — Timer setup for each data refresh job.
 */

import { logger } from '../../lib/logger.js';
import { ONE_MINUTE, ONE_HOUR, THIRTY_MINUTES, TWENTY_FOUR_HOURS, ONE_WEEK } from './types.js';
import { msUntilAestHour, msUntilSundayMidnightAest } from './schedule-manager.js';

type TimerHandle = ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>;

interface ScheduleContext {
  timers: Map<string, TimerHandle>;
  updateNextRun: (name: string, delayMs: number) => void;
  runJobIfEnabled: (name: string) => Promise<void>;
}

export function scheduleRbaData(ctx: ScheduleContext): void {
  const name = 'rba_data';
  const delayMs = msUntilAestHour(6);
  ctx.updateNextRun(name, delayMs);
  const initialTimer = setTimeout(() => {
    void ctx.runJobIfEnabled(name);
    const interval = setInterval(() => {
      void ctx.runJobIfEnabled(name);
      ctx.updateNextRun(name, TWENTY_FOUR_HOURS);
    }, TWENTY_FOUR_HOURS);
    ctx.timers.set(name, interval);
  }, delayMs);
  ctx.timers.set(name, initialTimer);
  logger.info(`[Scheduler] rba_data: first run in ${Math.round(delayMs / ONE_MINUTE)} min`);
}

export function scheduleAbsData(ctx: ScheduleContext): void {
  const name = 'abs_data';
  const delayMs = msUntilAestHour(7);
  ctx.updateNextRun(name, delayMs);
  const initialTimer = setTimeout(() => {
    void ctx.runJobIfEnabled(name);
    const interval = setInterval(() => {
      void ctx.runJobIfEnabled(name);
      ctx.updateNextRun(name, TWENTY_FOUR_HOURS);
    }, TWENTY_FOUR_HOURS);
    ctx.timers.set(name, interval);
  }, delayMs);
  ctx.timers.set(name, initialTimer);
  logger.info(`[Scheduler] abs_data: first run in ${Math.round(delayMs / ONE_MINUTE)} min`);
}

export function scheduleAsxPrices(ctx: ScheduleContext): void {
  const name = 'asx_prices';
  ctx.updateNextRun(name, ONE_HOUR);
  const interval = setInterval(() => {
    void ctx.runJobIfEnabled(name);
    ctx.updateNextRun(name, ONE_HOUR);
  }, ONE_HOUR);
  ctx.timers.set(name, interval);
  logger.info(`[Scheduler] asx_prices: every 1 hour (trading hours only)`);
}

export function scheduleCryptoPrices(ctx: ScheduleContext): void {
  const name = 'crypto_prices';
  ctx.updateNextRun(name, THIRTY_MINUTES);
  const interval = setInterval(() => {
    void ctx.runJobIfEnabled(name);
    ctx.updateNextRun(name, THIRTY_MINUTES);
  }, THIRTY_MINUTES);
  ctx.timers.set(name, interval);
  logger.info(`[Scheduler] crypto_prices: every 30 min`);
}

export function scheduleSentiment(ctx: ScheduleContext): void {
  const name = 'sentiment';
  const delayMs = msUntilAestHour(8);
  ctx.updateNextRun(name, delayMs);
  const initialTimer = setTimeout(() => {
    void ctx.runJobIfEnabled(name);
    const interval = setInterval(() => {
      void ctx.runJobIfEnabled(name);
      ctx.updateNextRun(name, TWENTY_FOUR_HOURS);
    }, TWENTY_FOUR_HOURS);
    ctx.timers.set(name, interval);
  }, delayMs);
  ctx.timers.set(name, initialTimer);
  logger.info(`[Scheduler] sentiment: first run in ${Math.round(delayMs / ONE_MINUTE)} min`);
}

export function scheduleCogneeIndex(ctx: ScheduleContext): void {
  const name = 'cognee_index';
  const delayMs = msUntilAestHour(9);
  ctx.updateNextRun(name, delayMs);
  const initialTimer = setTimeout(() => {
    void ctx.runJobIfEnabled(name);
    const interval = setInterval(() => {
      void ctx.runJobIfEnabled(name);
      ctx.updateNextRun(name, TWENTY_FOUR_HOURS);
    }, TWENTY_FOUR_HOURS);
    ctx.timers.set(name, interval);
  }, delayMs);
  ctx.timers.set(name, initialTimer);
  logger.info(`[Scheduler] cognee_index: first run in ${Math.round(delayMs / ONE_MINUTE)} min`);
}

export function scheduleCalendar(ctx: ScheduleContext): void {
  const name = 'calendar';
  const delayMs = msUntilSundayMidnightAest();
  ctx.updateNextRun(name, delayMs);
  const initialTimer = setTimeout(() => {
    void ctx.runJobIfEnabled(name);
    const interval = setInterval(() => {
      void ctx.runJobIfEnabled(name);
      ctx.updateNextRun(name, ONE_WEEK);
    }, ONE_WEEK);
    ctx.timers.set(name, interval);
  }, delayMs);
  ctx.timers.set(name, initialTimer);
  logger.info(`[Scheduler] calendar: first run in ${Math.round(delayMs / ONE_HOUR)} hours`);
}
