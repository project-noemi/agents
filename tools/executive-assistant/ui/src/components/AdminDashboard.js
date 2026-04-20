export class AdminDashboard extends HTMLElement {
  constructor() {
    super();
    this.queue = [];
    this.rules = { vip: [], ignore: [] };
    this.stats = {};
    this.logs = [];
  }

  async connectedCallback() {
    this.innerHTML = `
      <div class="noemi-dashboard">
        <!-- Review Queue Panel -->
        <div class="glass-card">
          <div class="card-header">
            <span>Human Review Queue</span>
            <span class="badge badge-warning" id="queue-count">0 Pending</span>
          </div>
          <div id="queue-container">
            <p style="color: var(--text-secondary); text-align: center;">Loading tasks...</p>
          </div>
        </div>

        <!-- Rules Panel -->
        <div class="glass-card">
          <div class="card-header">
            <span>Triage Rules</span>
          </div>
          <div>
            <h4 style="margin-bottom: 0.5rem; color: var(--text-secondary);">VIP Senders</h4>
            <ul id="vip-list" style="margin-top:0; padding-left: 1.5rem; color: var(--accent-primary);"></ul>
            <h4 style="margin-bottom: 0.5rem; color: var(--text-secondary);">Ignore Patterns</h4>
            <ul id="ignore-list" style="margin-top:0; padding-left: 1.5rem; color: var(--danger-base);"></ul>
          </div>
        </div>
        
        <!-- System Stats / Execution Panel -->
        <div class="glass-card" style="grid-column: 1 / -1;">
          <div class="card-header">
            <span>Execution Monitoring & Status</span>
            <span class="badge" style="background:#e8f0fe; color:#1a73e8;" id="uptime-badge">Uptime: 0s</span>
          </div>
          <div style="display: flex; gap: 2rem; margin-bottom: 1.5rem;">
            <div><strong style="color:var(--text-secondary)">Total Processed:</strong> <span id="stat-processed">0</span></div>
            <div><strong style="color:var(--text-secondary)">Auto Routed:</strong> <span id="stat-routed">0</span></div>
            <div><strong style="color:var(--text-secondary)">Last Sync:</strong> <span id="stat-sync">Pending</span></div>
          </div>
          <div style="max-height: 200px; overflow-y: auto; background: #f1f3f4; padding: 1rem; border-radius: 4px; font-family: monospace; font-size: 0.85rem;" id="exec-logs">
            <!-- execution logs render here -->
          </div>
        </div>

      </div>
    `;

    await this.fetchData();
  }

  async fetchData() {
    try {
      // Intended to connect safely to the Express backend running on the same host proxy.
      const [queueRes, rulesRes, statsRes, logsRes] = await Promise.all([
        fetch('/api/queue').catch(() => ({ ok: false })),
        fetch('/api/rules').catch(() => ({ ok: false })),
        fetch('/api/stats').catch(() => ({ ok: false })),
        fetch('/api/logs').catch(() => ({ ok: false }))
      ]);

      // Provide mock data if the backend isn't mounted for decoupled UI testing
      this.queue = queueRes.ok ? await queueRes.json() : [];
      this.rules = rulesRes.ok ? await rulesRes.json() : { vip: [], ignore: [] };
      this.stats = statsRes.ok ? await statsRes.json() : { totalProcessed: 0, autoRouted: 0, uptimeSecs: 0, lastSync: 'N/A' };
      this.logs = logsRes.ok ? await logsRes.json() : [];

      this.render();
    } catch (e) {
      console.error("Dashboard failed to fetch NoéMI state:", e);
    }
  }

  async resolveTask(taskId, resolutionType) {
    // Optimistic UI updates
    this.queue = this.queue.filter(q => q.id !== taskId);
    this.render();

    // Fire resolution back to the Learning Agent
    await fetch('/api/resolution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, resolution: resolutionType })
    }).catch(e => console.warn("Mock resolution logged.", e));
  }

  render() {
    document.getElementById('queue-count').innerText = `${this.queue.length} Pending`;

    const queueHtml = this.queue.length === 0 
      ? `<p style="color: var(--success-base); text-align: center;">Queue is clear. Excellent workflow.</p>`
      : this.queue.map(item => `
        <div class="queue-item" data-id="${item.id}">
          <div class="queue-meta">From: ${item.from} — Confidence: ${item.confidence}</div>
          <div class="queue-subject">${item.subject}</div>
          <div class="queue-meta" style="color: var(--danger-base); margin-bottom: 1rem;">Reason: ${item.reason}</div>
          
          <div style="background: #f1f3f4; padding: 0.75rem; border-radius: 4px; border: 1px solid #dadce0; margin-bottom: 1rem;">
             <strong style="color: #202124; font-size: 0.85rem;">Thread Context:</strong>
             ${item.messages ? item.messages.map(m => `
               <div style="font-family: monospace; font-size: 0.8rem; border-left: 2px solid #bdc1c6; padding-left: 0.5rem; margin-top: 0.5rem;">
                 ${m.body}
               </div>
             `).join('') : '<span style="font-size:0.8rem;">No messages recorded.</span>'}
          </div>

          <div class="btn-group">
            <button class="btn btn-success" onclick="this.getRootNode().host.resolveTask('${item.id}', 'approve')">Approve Route</button>
            <button class="btn btn-primary" onclick="this.getRootNode().host.resolveTask('${item.id}', 'reroute')">Train Ruleset</button>
            <button class="btn btn-danger" onclick="this.getRootNode().host.resolveTask('${item.id}', 'block')">Block</button>
          </div>
        </div>
      `).join('');

    document.getElementById('queue-container').innerHTML = queueHtml;
    document.getElementById('vip-list').innerHTML = this.rules.vip.map(r => `<li>${r}</li>`).join('');
    document.getElementById('ignore-list').innerHTML = this.rules.ignore.map(r => `<li>${r}</li>`).join('');
    
    // Stats and Monitoring Render
    document.getElementById('stat-processed').innerText = this.stats.totalProcessed;
    document.getElementById('stat-routed').innerText = this.stats.autoRouted;
    document.getElementById('stat-sync').innerText = this.stats.lastSync;
    document.getElementById('uptime-badge').innerText = `Uptime: ${this.stats.uptimeSecs}s`;
    
    document.getElementById('exec-logs').innerHTML = this.logs.map(l => 
      `<div style="margin-bottom:0.5rem; border-left: 2px solid #1a73e8; padding-left: 0.5rem;">
        <span style="color: #5f6368">[${new Date(l.timestamp).toLocaleTimeString()}]</span> 
        <strong>${l.event}</strong>: ${l.details}
      </div>`
    ).join('');
  }
}
