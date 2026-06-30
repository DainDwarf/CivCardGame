import { describe, it, expect } from 'vitest';
import { coreCollapse } from './collapse';
import { emptyResources } from './resources';

describe('coreCollapse', () => {
  it('returns null when all resources are non-negative', () => {
    const r = { food: 0, production: 0, science: 0, military: 0, money: 0 };
    expect(coreCollapse(r)).toBeNull();
  });

  it('detects famine when food goes negative', () => {
    const r = { ...emptyResources(), food: -1 };
    expect(coreCollapse(r)).toBe('famine');
  });

  it('detects ruin when production goes negative', () => {
    const r = { ...emptyResources(), production: -1 };
    expect(coreCollapse(r)).toBe('ruin');
  });

  it('detects bankruptcy when money goes negative', () => {
    const r = { ...emptyResources(), money: -1 };
    expect(coreCollapse(r)).toBe('bankruptcy');
  });

  it('detects dark_age when science goes negative', () => {
    const r = { ...emptyResources(), science: -1 };
    expect(coreCollapse(r)).toBe('dark_age');
  });

  it('detects revolt when military goes negative', () => {
    const r = { ...emptyResources(), military: -1 };
    expect(coreCollapse(r)).toBe('revolt');
  });

  it('food takes priority over other negative resources (checked first)', () => {
    const r = { food: -1, production: -1, science: -1, military: -1, money: -1 };
    expect(coreCollapse(r)).toBe('famine');
  });
});
