export class TriageRouter {
  constructor() {
    this.vipDomains = [];
    this.vipSenders = [];
    this.ignorePatterns = [];
  }

  route(message) {
    // Basic route implementation
    const sender = message.from || '';
    const domain = sender.split('@')[1];

    if (this.ignorePatterns.some(pattern => sender.includes(pattern))) {
      return 'IGNORE';
    }
    if (this.vipSenders.includes(sender) || this.vipDomains.includes(domain)) {
      return 'VIP';
    }
    return 'STANDARD';
  }
}
