import { describe, it, expect, vi } from 'vitest';
import { DeltaSync } from '../delta-sync.js';
import { StateManager } from '../state-manager.js';
import { TriageRouter } from '../triage-router.js';

describe('DeltaSync', () => {
  it('syncMailbox successfully', async () => {
    const mockGmailClient = {
      getProfile: vi.fn().mockResolvedValue({ historyId: '1000' })
    };
    const stateManager = new StateManager();
    const router = new TriageRouter();
    
    const deltaSync = new DeltaSync(mockGmailClient, stateManager, router);
    const result = await deltaSync.syncMailbox('test@test.com');
    
    expect(result).toEqual({
      status: 'INITIALIZED',
      emailAddress: 'test@test.com',
      historyId: '1000'
    });
    expect(mockGmailClient.getProfile).toHaveBeenCalledWith('test@test.com');
  });

  it('throws error when sync fails', async () => {
    const mockGmailClient = {
      getProfile: vi.fn().mockRejectedValue(new Error('API Error'))
    };
    const deltaSync = new DeltaSync(mockGmailClient, new StateManager(), new TriageRouter());
    
    await expect(deltaSync.syncMailbox('test@test.com')).rejects.toThrow('API Error');
  });
});
