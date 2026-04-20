/**
 * oauth-manager.js
 * Project NoéMI - Secrets & OAuth Token Abstraction
 * 
 * Fetches secrets dynamically from the environment (injected via Secret Manager)
 * and maintains continuous offline access to the Gmail API.
 */
import { google } from 'googleapis';

export class OAuthManager {
  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID;
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    // Realistically this refresh token is pulled from Postgres per-user
    this.refreshToken = process.env.GMAIL_REFRESH_TOKEN; 

    if (!this.clientId || !this.clientSecret) {
      console.warn('[Security] Missing GOOGLE_CLIENT_ID or SECRET. Ensure Fetch-on-Demand injection is active.');
    }

    this.oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      process.env.REDIRECT_URI || 'http://localhost:8080/oauth2callback'
    );

    if (this.refreshToken) {
      this.oauth2Client.setCredentials({
        refresh_token: this.refreshToken
      });
    }
  }

  /**
   * Generates the abstracted GmailClient wrapper that matches the signature
   * expected by `delta-sync.js`
   */
  getGmailClient() {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    return {
      getProfile: async (mailboxId) => {
        const res = await gmail.users.getProfile({ userId: mailboxId });
        return res.data;
      },
      getHistory: async (mailboxId, startHistoryId) => {
        const res = await gmail.users.history.list({
          userId: mailboxId,
          startHistoryId: startHistoryId
        });
        return res.data;
      },
      getMessageMetadata: async (mailboxId, messageId) => {
        const res = await gmail.users.messages.get({
          userId: mailboxId,
          id: messageId,
          format: 'metadata' // Crucial to prevent heavy body loads
        });
        return res.data;
      }
    };
  }
}
