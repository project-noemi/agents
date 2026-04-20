import { describe, it, expect, vi } from 'vitest';
import { OAuthManager } from '../oauth-manager.js';
import { google } from 'googleapis';

vi.mock('googleapis', () => {
  return {
    google: {
      auth: {
        OAuth2: vi.fn().mockImplementation(() => ({
          setCredentials: vi.fn()
        }))
      },
      gmail: vi.fn().mockReturnValue({
        users: {
          getProfile: vi.fn().mockResolvedValue({ data: { historyId: '123' } }),
          history: {
            list: vi.fn().mockResolvedValue({ data: { history: [] } })
          },
          messages: {
            get: vi.fn().mockResolvedValue({ data: { id: 'msg1' } })
          }
        }
      })
    }
  };
});

describe('OAuthManager', () => {
  it('initializes oauth client properly', () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    process.env.GMAIL_REFRESH_TOKEN = 'test-token';
    
    const manager = new OAuthManager();
    expect(manager).toBeDefined();
    expect(manager.clientId).toBe('test-client');
  });

  it('provides a functioning getGmailClient wrapper', async () => {
    const manager = new OAuthManager();
    const client = manager.getGmailClient();
    
    const profile = await client.getProfile('test@test.com');
    expect(profile).toHaveProperty('historyId', '123');

    const history = await client.getHistory('test@test.com', '100');
    expect(history).toHaveProperty('history');

    const meta = await client.getMessageMetadata('test@test.com', 'msg1');
    expect(meta).toHaveProperty('id', 'msg1');
  });
});
