import { describe, it, expect } from 'vitest';
import { StateManager } from '../state-manager.js';

describe('StateManager', () => {
  it('initializes and manages state', () => {
    const manager = new StateManager();
    expect(manager.get('key')).toBeUndefined();
    
    manager.set('key', 'value');
    expect(manager.get('key')).toBe('value');
  });
});
