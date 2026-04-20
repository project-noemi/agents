import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock dependencies safely before importing server logic
vi.mock('../oauth-manager.js', () => ({
  OAuthManager: vi.fn().mockImplementation(() => ({
    getGmailClient: () => ({
      getHistory: vi.fn().mockResolvedValue({ historyId: '1001', history: [] }),
      getProfile: vi.fn().mockResolvedValue({ historyId: '1000' })
    })
  }))
}));

// Create a local test instance identical to the server setup to avoid binding the port 
import { DeltaSync } from '../delta-sync.js';
import { StateManager } from '../state-manager.js';
import { TriageRouter } from '../triage-router.js';
import { OAuthManager } from '../oauth-manager.js';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  const stateManager = new StateManager();
  const triageRouter = new TriageRouter();
  const oauthManager = new OAuthManager();
  const deltaSync = new DeltaSync(oauthManager.getGmailClient(), stateManager, triageRouter);

  app.post('/', async (req, res) => {
    if (!req.body || !req.body.message) {
      return res.status(400).send('Bad Request');
    }
    const pubsubMessage = req.body.message;
    const data = Buffer.from(pubsubMessage.data, 'base64').toString();
    const payload = JSON.parse(data);
    const result = await deltaSync.syncMailbox(payload.emailAddress);
    res.status(200).json(result);
  });
  return app;
};

describe('Cloud Run Webhook Integration', () => {
  const app = buildApp();

  it('rejects malformed payloads', async () => {
    const res = await request(app).post('/').send({ invalid: 'body' });
    expect(res.status).toBe(400);
  });

  it('handles Base64 Pub/Sub payload gracefully', async () => {
    // Gmail API Pubsub structure encapsulates custom payload in "data" Base64.
    const mockData = { emailAddress: 'exec@example.com', historyId: '1000' };
    const base64Data = Buffer.from(JSON.stringify(mockData)).toString('base64');

    const pubsubPayload = {
      message: {
        data: base64Data,
        messageId: '1234567890'
      }
    };

    const res = await request(app).post('/').send(pubsubPayload);
    
    // Check that it accepted and triggered the "INITIALIZED" bounding state from delta-sync logic
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('INITIALIZED');
  });
});
