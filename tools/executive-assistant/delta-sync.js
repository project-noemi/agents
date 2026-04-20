export class DeltaSync {
  constructor(gmailClient, stateManager, triageRouter) {
    this.gmailClient = gmailClient;
    this.stateManager = stateManager;
    this.triageRouter = triageRouter;
  }

  async syncMailbox(emailAddress) {
    try {
      const profile = await this.gmailClient.getProfile(emailAddress);
      
      return { 
        status: 'INITIALIZED',
        emailAddress,
        historyId: profile.historyId
      };
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }
}
