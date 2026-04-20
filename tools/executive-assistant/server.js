import express from 'express';
import { DeltaSync } from './delta-sync.js';
import { StateManager } from './state-manager.js';
import { TriageRouter } from './triage-router.js';
import { OAuthManager } from './oauth-manager.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// Serve the Vite admin dashboard modular bundle
app.use('/admin', express.static(path.join(__dirname, 'ui/dist')));

// Initialize components (Ideally via Dependency Injection or factory in production)
const stateManager = new StateManager();
const triageRouter = new TriageRouter();
const oauthManager = new OAuthManager();
const deltaSync = new DeltaSync(oauthManager.getGmailClient(), stateManager, triageRouter);

/**
 * Pub/Sub Push Webhook Endpoint
 * Cloud Run executes this POST handler on each Gmail event.
 */
app.post('/', async (req, res) => {
  try {
    if (!req.body || !req.body.message) {
      return res.status(400).send('Bad Request: Invalid Pub/Sub message format');
    }

    const pubsubMessage = req.body.message;
    const data = Buffer.from(pubsubMessage.data, 'base64').toString();
    const payload = JSON.parse(data);

    const emailAddress = payload.emailAddress;
    const historyId = payload.historyId;

    console.log(`[Pub/Sub] Notification received for: ${emailAddress} - New historyId: ${historyId}`);

    // Offload the history processing natively 
    const result = await deltaSync.syncMailbox(emailAddress);
    
    console.log(`[Triage Router] Execution Complete:`, result);

    // Respond 200 OK to Pub/Sub to acknowledge receipt immediately
    res.status(200).json(result);
  } catch (error) {
    console.error('[Error] Failed to process Pub/Sub hook:', error);
    // Returning 500 pushes the message back into the Pub/Sub retry queue (Exponential Backoff)
    res.status(500).send('Internal Server Error');
  }
});

// --- Admin REST API Endpoints ---

// Thread Aggregator / Firestore Mock Database
// Represents the parsed context grouped by exact Gmail threadId
let firestoreThreadDocs = [
  { 
    id: 'thread_18f9e2', 
    subject: 'Re: Invoice Discrepancy #592', 
    from: 'vendor@example.com', 
    confidence: 0.60, 
    reason: 'Ambiguous financial request context gap.',
    messages: [
      { messageId: 'msg_001', body: 'Invoice 592 is missing an PO number. Please advise.' },
      { messageId: 'msg_002', body: 'Will check.' },
      { messageId: 'msg_003', body: 'Any update on this?' }
    ]
  },
  { 
    id: 'thread_44a2c9', 
    subject: 'Are you available tomorrow?', 
    from: 'external@random.net', 
    confidence: 0.40, 
    reason: 'Unknown scheduling context attempting calendar access.',
    messages: [
      { messageId: 'msg_001', body: 'Let me know if we can meet tomorrow at 2PM EST.' }
    ]
  }
];

// Mock database structures for agent monitoring and statistics
let execLogs = [
  { timestamp: new Date(Date.now() - 60000).toISOString(), event: 'SYNC_COMPLETE', details: 'Mailbox exec@noemi.local synced successfully', actions: 2 },
  { timestamp: new Date(Date.now() - 120000).toISOString(), event: 'TRIAGE_VIP', details: 'Message msg_1routed to VIP branch (boss@company.com)', actions: 1 }
];

let systemStats = {
  totalProcessed: 1042,
  flaggedForReview: 14,
  autoRouted: 1028,
  uptimeSecs: process.uptime(),
  lastSync: new Date(Date.now() - 60000).toISOString()
};

app.get('/api/queue', (req, res) => {
  res.json(firestoreThreadDocs);
});

app.post('/api/resolution', (req, res) => {
  const { taskId, resolution } = req.body;
  
  const resolvedThread = firestoreThreadDocs.find(t => t.id === taskId);
  firestoreThreadDocs = firestoreThreadDocs.filter(t => t.id !== taskId);
  
  // Log the resolution loop processing
  execLogs.unshift({
    timestamp: new Date().toISOString(),
    event: 'LEARNING_AGENT_UPDATE',
    details: `Thread ${taskId} resolved as: ${resolution} [Historical messages passed]`,
    actions: resolvedThread ? resolvedThread.messages.length : 1
  });
  
  console.log(`[Learning Agent] Thread ${taskId} context mapped and resolved as: ${resolution}`);
  res.status(200).json({ success: true, message: 'Resolution processed by Learning Agent' });
});

app.get('/api/rules', (req, res) => {
  const rules = triageRouter; 
  res.json({ vip: rules.vipDomains.concat(rules.vipSenders), ignore: rules.ignorePatterns });
});

// Dynamic configuration aspect update
app.put('/api/rules', (req, res) => {
  const { ruleType, pattern } = req.body;
  if (ruleType === 'vip') {
    triageRouter.vipSenders.push(pattern);
  } else if (ruleType === 'ignore') {
    triageRouter.ignorePatterns.push(pattern);
  }
  
  execLogs.unshift({
    timestamp: new Date().toISOString(),
    event: 'CONFIG_UPDATE',
    details: `Added ${pattern} to ${ruleType} logic arrays.`,
    actions: 1
  });

  res.status(200).json({ success: true, message: 'Configuration successfully mutated.' });
});

// Agent execution statistics
app.get('/api/stats', (req, res) => {
  systemStats.uptimeSecs = Math.floor(process.uptime());
  res.json(systemStats);
});

// Agent Execution log stream
app.get('/api/logs', (req, res) => {
  res.json(execLogs.slice(0, 50)); // Last 50 executions
});

app.listen(PORT, () => {
  console.log(`🚀 NoéMI Cloud Run Executive Assistant listening on port ${PORT}`);
});
