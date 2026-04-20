import { describe, it, expect } from 'vitest';
import { TriageRouter } from '../triage-router.js';

describe('TriageRouter', () => {
  it('initializes with empty lists', () => {
    const router = new TriageRouter();
    expect(router.vipDomains).toEqual([]);
    expect(router.vipSenders).toEqual([]);
    expect(router.ignorePatterns).toEqual([]);
  });

  it('routes to VIP when sender or domain matches', () => {
    const router = new TriageRouter();
    router.vipSenders.push('boss@company.com');
    router.vipDomains.push('important.com');

    expect(router.route({ from: 'boss@company.com' })).toBe('VIP');
    expect(router.route({ from: 'someone@important.com' })).toBe('VIP');
  });

  it('routes to IGNORE when pattern matches', () => {
    const router = new TriageRouter();
    router.ignorePatterns.push('noreply');

    expect(router.route({ from: 'noreply@spam.com' })).toBe('IGNORE');
  });

  it('routes to STANDARD by default', () => {
    const router = new TriageRouter();
    expect(router.route({ from: 'random@email.com' })).toBe('STANDARD');
  });
});
