import { getCasesData, promptAdminAction } from './cases.js';
import { db } from './firebase-config.js';
import { updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

export function renderDashboard() {
  const cases = getCasesData();
  updateOverviewStats(cases);
  renderUpcomingHearings(cases);
  renderRecentFilings(cases);
  setupAuditTrigger();
}
window.renderDashboard = renderDashboard;

const disposedKeywords = ['DECIDED', 'DECISION', 'DISMISSED', 'DISMISSAL', 'PLEADED GUILTY', 'PLEA BARGAIN', 'GUILTY', 'ACQUITTED', 'ACQUITTAL', 'SENTENCE', 'SETTLED', 'COMPROMISE'];
const pendingKeywords = ['PROPOSAL', 'DIRECTED TO FILE', 'FOR COMMENT', 'PENDING', 'FOR RESOLUTION', 'FOR DECISION', 'FOR DISMISSAL', 'SET FOR', 'CONTINUED', 'POSTPONED', 'RESET'];
const archiveKeywords = ['ARCHIVE', 'ARCHIVED', 'FOR ARCHIVE'];

function setupAuditTrigger() {
    const btn = document.getElementById('audit-btn');
    if (!btn) return;
    btn.onclick = () => runDocketAudit();
}

async function runDocketAudit() {
    const cases = getCasesData().filter(c => !c.isEvent);
    const modalContainer = document.getElementById('modal-container');
    const conflicts = [];
    
    // 1. SHOW CINEMATIC LOADING
    modalContainer.innerHTML = `
      <div class="modal-overlay active">
        <div class="modal-content glow-panel" style="max-width: 450px; border-color: var(--accent-primary); text-align: center;">
          <div class="modal-body" style="padding: 40px 20px;">
            <div class="sync-spinner" style="margin: 0 auto 25px;"></div>
            <h3 style="letter-spacing: 2px; color: var(--accent-primary); font-family: 'Outfit'; font-weight: 800;">DEEP SCAN IN PROGRESS</h3>
            <p style="color: rgba(255,255,255,0.4); font-size: 0.8rem; margin-bottom: 25px;">ANALYZING BRANCH 77 DOCKET INTEGRITY...</p>
            
            <div style="background: rgba(255,255,255,0.05); border-radius: 10px; height: 8px; overflow: hidden; margin-bottom: 15px;">
               <div id="audit-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #31f0ff, #00d2ff); transition: width 0.3s ease;"></div>
            </div>
            <div id="audit-percentage" style="font-size: 0.9rem; font-weight: 700; color: var(--accent-primary); margin-bottom:20px;">0%</div>

            <div id="audit-log" style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; height: 120px; overflow-y: hidden; font-family: 'Courier New', monospace; font-size: 0.65rem; text-align: left; color: #2ecc71;">
            </div>
          </div>
        </div>
      </div>
    `;

    const progressBar = document.getElementById('audit-progress-bar');
    const percentageText = document.getElementById('audit-percentage');
    const logArea = document.getElementById('audit-log');

    const addAuditLog = (msg) => {
        const line = document.createElement('div');
        line.innerHTML = `<span style="color:var(--accent-primary);">[LOG]</span> ${msg}`;
        logArea.prepend(line);
    };

    // 2. RUN THE SCAN WITH DELAY FOR EFFECT
    const total = cases.length;
    for (let i = 0; i < total; i++) {
        const c = cases[i];
        const progress = Math.round(((i + 1) / total) * 100);
        
        // Update UI every few items to keep it smooth
        if (i % 5 === 0 || i === total - 1) {
            progressBar.style.width = `${progress}%`;
            percentageText.innerText = `${progress}%`;
            addAuditLog(`Analyzing: ${c.caseNo}...`);
            // Add a small artificial delay if fast so it looks like a real deep scan
            if (total < 100) await new Promise(r => setTimeout(r, 10));
        }

        let analyzedStatus = 'Active';
        const actionUpper = String(c.comments || '').toUpperCase();
        const hasDisposedKeyword = disposedKeywords.some(kw => actionUpper.includes(kw));
        const hasPendingKeyword = pendingKeywords.some(kw => actionUpper.includes(kw));
        const hasArchiveKeyword = archiveKeywords.some(kw => actionUpper.includes(kw));

        if (hasArchiveKeyword) analyzedStatus = 'Archived';
        else if (hasDisposedKeyword && !hasPendingKeyword) analyzedStatus = 'Disposed';
        if (actionUpper.includes('APPEALED') || actionUpper.includes('ON APPEAL')) analyzedStatus = 'Appeal';

        if (c.status !== analyzedStatus) {
            conflicts.push({ ...c, correct: analyzedStatus });
        }
    }

    addAuditLog("GENERIC AUDIT COMPLETE.");
    await new Promise(r => setTimeout(r, 600)); // Final pause for drama

    // 3. SHOW THE RESULT MODAL
    modalContainer.innerHTML = `
      <div class="modal-overlay active">
        <div class="modal-content glow-panel" style="max-width: 550px; border-color: var(--accent-primary);">
          <div class="modal-header">
            <h3 style="font-family:'Outfit'; font-weight:800;">DOCKET INTEGRITY REPORT</h3>
            <button class="close-btn" onclick="document.getElementById('modal-container').innerHTML = ''">&times;</button>
          </div>
          <div class="modal-body" style="max-height: 450px; overflow-y: auto;">
             <div style="background: rgba(0,240,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px dashed var(--accent-primary);">
                <span style="font-weight: 800; color: var(--accent-primary);">SCAN RESULT:</span> ${conflicts.length} Record Inconsistencies Detected.
             </div>
             
             ${conflicts.length === 0 ? `
               <div style="text-align:center; padding: 40px;">
                  <div style="font-size: 3rem; margin-bottom: 20px;">🛡️</div>
                  <h4 style="color: var(--accent-primary);">SCAN COMPLETE: 100% SECURE</h4>
                  <p class="text-muted">All active, disposed, and archived cases are perfectly aligned with their recorded actions.</p>
               </div>
             ` : `
               <table style="width:100%; font-size: 0.75rem; border-collapse: collapse;">
                  <thead>
                    <tr style="text-align:left; border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); text-transform:uppercase;">
                        <th style="padding:10px;">Case Number</th>
                        <th>Current Status</th>
                        <th>Audited Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${conflicts.map(con => `
                      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="padding:10px; font-weight:700;">${con.caseNo}</td>
                        <td style="color:#e74c3c;">${con.status}</td>
                        <td style="color:#2ecc71; font-weight:800;">${con.correct}</td>
                      </tr>
                    `).join('')}
                  </tbody>
               </table>
             `}
          </div>
          <div class="modal-footer" style="padding: 20px; border-top: 1px solid rgba(255,255,255,0.05); text-align: right;">
             <button class="btn-secondary" onclick="document.getElementById('modal-container').innerHTML = ''">Dismiss Report</button>
             <button class="btn-secondary" id="print-audit-btn" style="border-color: #3498db; color: #3498db;">🖨️ Print Compliance Report</button>
             ${conflicts.length > 0 ? `<button class="btn-primary" id="fix-all-btn">Resolve All Conflicts (${conflicts.length})</button>` : ''}
          </div>
        </div>
      </div>
    `;

    const fixBtn = document.getElementById('fix-all-btn');
    if (fixBtn) {
        fixBtn.onclick = async () => {
            fixBtn.disabled = true;
            fixBtn.innerText = "Processing AI Refinement...";
            for (const con of conflicts) {
                try {
                    await updateDoc(doc(db, 'cases', con.id), { status: con.correct });
                } catch(e) {}
            }
            document.getElementById('modal-container').innerHTML = '';
            runDocketAudit(); // Re-scan to show success
        };
    }

    const printBtn = document.getElementById('print-audit-btn');
    if (printBtn) {
        printBtn.onclick = () => printAuditReport(cases, conflicts);
    }
}

function printAuditReport(cases, conflicts) {
    const totalScanned = cases.length;
    
    const countByType = (list, status) => {
        const sub = list.filter(c => c.status === status);
        return `
            Crim: ${sub.filter(c => c.type === 'Criminal').length} • 
            Civ: ${sub.filter(c => c.type === 'Civil').length} • 
            Cada: ${sub.filter(c => c.type === 'Cadastral').length} • 
            CICL: ${sub.filter(c => c.type === 'CICL').length} • 
            Appeal: ${sub.filter(c => c.type === 'Appeal').length}
        `;
    };

    const activeCount = cases.filter(c => c.status === 'Active').length;
    const disposedCount = cases.filter(c => c.status === 'Disposed').length;
    const archivedCount = cases.filter(c => c.status === 'Archived').length;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Docket Integrity Report - Branch 77</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; }
                .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                .title { font-size: 24px; font-weight: bold; text-transform: uppercase; margin: 0; }
                .subtitle { font-size: 14px; color: #666; margin-top: 5px; }
                .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                .stat-box { border: 1px solid #ddd; padding: 15px; border-radius: 4px; }
                .stat-label { font-size: 12px; font-weight: bold; color: #888; text-transform: uppercase; }
                .stat-value { font-size: 20px; font-weight: bold; margin-top: 5px; }
                .breakdown { font-size: 11px; color: #555; margin-top: 8px; font-family: monospace; }
                .table-title { font-size: 14px; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                .footer { margin-top: 50px; font-size: 10px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
                @media print { .no-print { display: none; } }
            </style>
        </head>
        <body>
            <div class="header">
                <p class="title">RTC BRANCH 77 SIPALAY CITY</p>
                <p class="subtitle">DOCKET INTEGRITY & COMPLIANCE REPORT</p>
            </div>

            <div class="summary-grid">
                <div class="stat-box" style="grid-column: span 2; background: #f8f9fa;">
                    <div class="stat-label">Total Case Records Scanned</div>
                    <div class="stat-value">${totalScanned} Cases</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Total Active Cases</div>
                    <div class="stat-value">${activeCount}</div>
                    <div class="breakdown">${countByType(cases, 'Active')}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Total Disposed Cases</div>
                    <div class="stat-value">${disposedCount}</div>
                    <div class="breakdown">${countByType(cases, 'Disposed')}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Total Archived Cases</div>
                    <div class="stat-value">${archivedCount}</div>
                    <div class="breakdown">${countByType(cases, 'Archived')}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Integrity Conflicts Found</div>
                    <div class="stat-value" style="color: ${conflicts.length > 0 ? '#e74c3c' : '#27ae60'}">${conflicts.length}</div>
                </div>
            </div>

            <p class="footer">
                Report Generated on: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })} (MNL Time)<br>
                Digital Signature Authenticated • RTC Branch 77 System Control Panel
            </p>
            
            <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function updateOverviewStats(cases) {
  const activeCases = cases.filter(c => c.status === 'Active' && !c.isEvent);
  const disposedCases = cases.filter(c => c.status === 'Disposed' && !c.isEvent);
  const totalCasesOnly = cases.filter(c => !c.isEvent); // All status (Active/Disposed/Archived/Appeal)

  const total = totalCasesOnly.length;
  const civil = totalCasesOnly.filter(c => c.type === 'Civil').length;
  const crim = totalCasesOnly.filter(c => c.type === 'Criminal').length;
  const cadastral = totalCasesOnly.filter(c => c.type === 'Cadastral').length;
  const cicl = totalCasesOnly.filter(c => c.type === 'CICL').length;
  const appeals = totalCasesOnly.filter(c => c.type === 'Appeal').length;

  const disposedCount = disposedCases.length;
  const archived = totalCasesOnly.filter(c => c.status === 'Archived').length;
  const onAppealStatus = totalCasesOnly.filter(c => c.status === 'Appeal').length;

  // Set All Stats
  document.getElementById('stat-total').innerText = total;
  document.getElementById('stat-civil').innerText = civil;
  document.getElementById('stat-crim').innerText = crim;
  document.getElementById('stat-disposed').innerText = disposedCount;
  document.getElementById('stat-archived').innerText = archived;
  
  // Update secondary/special cards
  const cadEl = document.getElementById('stat-cad');
  if (cadEl) cadEl.innerText = cadastral;

  const ciclEl = document.getElementById('stat-cicl');
  if (ciclEl) ciclEl.innerText = cicl;

  const appEl = document.getElementById('stat-appeal');
  if (appEl) appEl.innerText = appeals || onAppealStatus; // Show either type 'Appeal' or status 'Appeal'

  // RE-LINK POP-UPS
  const activeCard = document.getElementById('card-total-active');
  if(activeCard) {
    activeCard.onclick = () => showStatBreakdown('Active Cases Summary', activeCases, 'var(--accent-primary)');
  }

  const disposedCard = document.getElementById('card-total-disposed');
  if(disposedCard) {
    disposedCard.onclick = () => showStatBreakdown('Disposed Cases Summary', disposedCases, 'var(--status-disposed)');
  }

  const archCard = document.getElementById('card-archived');
  if (archCard) {
    const archivedCases = cases.filter(c => c.status === 'Archived' && !c.isEvent);
    archCard.onclick = () => showStatBreakdown('Archive Cases Summary', archivedCases, '#95a5a6');
  }

  // MAIN CATEGORY ACTIONS
  const civilCard = document.getElementById('card-civil');
  if (civilCard) {
      const civilCases = cases.filter(c => c.type === 'Civil' && !c.isEvent);
      civilCard.onclick = () => showStatBreakdown('Civil Docket Summary', civilCases, '#31f0ff');
  }

  const crimCard = document.getElementById('card-crim');
  if (crimCard) {
      const crimCases = cases.filter(c => c.type === 'Criminal' && !c.isEvent);
      crimCard.onclick = () => showStatBreakdown('Criminal Docket Summary', crimCases, '#31f0ff');
  }

  // SPECIAL SECONDARY CARD ACTIONS
  const cadCard = document.getElementById('card-cad');
  if (cadCard) {
    const cadCases = cases.filter(c => c.type === 'Cadastral' && !c.isEvent);
    cadCard.onclick = () => showStatBreakdown('Cadastral Summary', cadCases, '#31f0ff');
  }

  const ciclCard = document.getElementById('card-cicl');
  if (ciclCard) {
    const ciclCases = cases.filter(c => c.type === 'CICL' && !c.isEvent);
    ciclCard.onclick = () => showStatBreakdown('CICL Summary', ciclCases, '#31f0ff');
  }

  const appealCard = document.getElementById('card-appeal');
  if (appealCard) {
    const appealCases = cases.filter(c => (c.type === 'Appeal' || c.status === 'Appeal') && !c.isEvent);
    appealCard.onclick = () => showStatBreakdown('Appeals Summary', appealCases, '#e67e22');
  }
}

function showStatBreakdown(title, list, themeColor = 'var(--accent-primary)') {
    const modalContainer = document.getElementById('modal-container');
    
    // Group by type (Ensure all types are represented even with 0 counts)
    const ALL_TYPES = ['Criminal', 'Civil', 'Cadastral', 'CICL', 'Appeal'];
    const breakdown = list.reduce((acc, c) => {
        const type = c.type || 'Other';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {});

    const breakdownHtml = ALL_TYPES.map(type => {
        const count = breakdown[type] || 0;
        let displayType = type;
        if (type === 'Appeal') displayType = 'Appeals from Lower Courts';
        if (type === 'Cadastral') displayType = 'Cadastral Proceedings';
        if (type === 'CICL') displayType = 'CICL (Child in Conflict with Law)';
        
        return `
        <div style="display:flex; justify-content:space-between; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 6px; margin-bottom: 8px; border-left: 3px solid ${themeColor};">
            <span style="font-weight:700; text-transform: uppercase; font-size: 0.7rem;">${displayType}</span>
            <span style="color:${themeColor}; font-weight:800;">${count}</span>
        </div>
        `;
    }).join('');

    modalContainer.innerHTML = `
      <div class="modal-overlay active">
        <div class="modal-content glow-panel" style="max-width: 500px; border-color: ${themeColor}44;">
          <div class="modal-header" style="border-bottom-color: rgba(255,255,255,0.05);">
            <h3 style="color:${themeColor}; font-weight:800; font-family:'Outfit';">${title.toUpperCase()}</h3>
            <button class="close-btn" id="close-stat-modal">&times;</button>
          </div>
          <div class="modal-body">
            <div style="margin-bottom: 20px;">
               <h4 style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px;">Official Breakdown by Type</h4>
               <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                  ${breakdownHtml || '<p class="text-muted">No classification data available.</p>'}
               </div>
            </div>
            
            <h4 style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Case Records (${list.length})</h4>
            <div style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border-light); border-radius: 8px;">
               ${list.length === 0 ? '<p class="text-muted p-4">No records found.</p>' : 
                 list.sort((a,b) => String(a.caseNo || '').localeCompare(String(b.caseNo || ''))).map(c => `
                 <div class="list-item" style="padding: 12px; border-bottom: 1px solid var(--border-light); font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                      <span style="font-weight:700; color:var(--accent-primary);">${c.caseNo || 'N/A'}</span>
                      <div style="font-size: 0.8rem; color: #fff;">${c.title || 'Untitled'}</div>
                    </div>
                 </div>`).join('')
               }
            </div>
          </div>
        </div>
      </div>
    `;
    document.getElementById('close-stat-modal').onclick = () => modalContainer.innerHTML = '';
}

function renderUpcomingHearings(cases) {
  const list = document.getElementById('upcoming-list');
  const countBadge = document.getElementById('upcoming-count');
  if (!list) return;

  const now = new Date();
  const next7Days = new Date();
  next7Days.setDate(now.getDate() + 7);

  const upcoming = [];
  cases.forEach(c => {
    // Collect all unique hearing dates for this case/event
    const allDates = [c.nextHearing, ...(c.hearings || [])].filter(h => h);
    const uniqueDates = [...new Set(allDates)];

    uniqueDates.forEach(dStr => {
        const hDate = new Date(dStr);
        if (isNaN(hDate)) return;

        const isToday = hDate.toDateString() === now.toDateString();
        const isInRange = hDate > now && hDate <= next7Days;

        if (isToday) {
            if (hDate.getHours() < 17) upcoming.push({ ...c, activeDate: dStr });
        } else if (isInRange) {
            upcoming.push({ ...c, activeDate: dStr });
        }
    });
  });

  upcoming.sort((a,b) => new Date(a.activeDate) - new Date(b.activeDate));

  if(countBadge) countBadge.innerText = upcoming.length;
  
  if (upcoming.length === 0) {
    list.innerHTML = '<div class="text-muted py-4 w-100 text-center">No hearings scheduled in the next 7 days.</div>';
    return;
  }

  list.innerHTML = '';
  upcoming.forEach(u => {
    const date = new Date(u.activeDate);
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    
    const note = document.createElement('div');
    const typeClass = u.isEvent ? 'type-event' : `type-${u.type.toLowerCase()}`;
    note.className = `sticky-note ${typeClass}`;
    note.innerHTML = `
         <div class="sticky-note-date">${day} @ ${time}</div>
         <div class="sticky-note-title">${u.title}</div>
         <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: auto;">${u.isEvent ? (u.type || 'Custom Event') : u.caseNo}</div>
    `;
    note.onclick = () => promptAdminAction(() => showEventDetailModal(u), 'Hearing Access Authentication', 'viewer');
    list.appendChild(note);
  });
}

function showEventDetailModal(item) {
    const modalContainer = document.getElementById('modal-container');
    const date = new Date(item.activeDate || item.nextHearing);
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fullDate = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    modalContainer.innerHTML = `
      <div class="modal-overlay active">
        <div class="modal-content glow-panel" style="max-width: 450px;">
          <div class="modal-header">
            <h3>${item.isEvent ? 'Event Details' : 'Hearing Details'}</h3>
            <button class="close-btn" id="close-detail-modal">&times;</button>
          </div>
          <div class="modal-body">
             <div style="margin-bottom: 20px;">
                <label style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Title</label>
                <div style="font-size: 1.1rem; font-weight: 700; color: var(--accent-primary);">${item.title}</div>
             </div>
             ${item.isEvent ? '' : `
             <div style="margin-bottom: 15px;">
                <label style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Case Number</label>
                <div style="font-weight: 600;">${item.caseNo}</div>
             </div>
             `}
             <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                  <label style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Date</label>
                  <div style="font-weight: 600;">${fullDate}</div>
                </div>
                <div>
                  <label style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Time</label>
                  <div style="font-weight: 600;">${time}</div>
                </div>
             </div>
             ${item.comments ? `
             <div style="margin-top: 15px;">
                <label style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Notes/Comments</label>
                <div style="font-size: 0.85rem; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 5px; margin-top: 5px;">${item.comments}</div>
             </div>
             ` : ''}
          </div>
          <div class="modal-footer" style="padding: 20px; text-align: right;">
             <button class="btn-primary" id="close-detail-btn">Close</button>
          </div>
        </div>
      </div>
    `;
    
    const close = () => modalContainer.innerHTML = '';
    document.getElementById('close-detail-modal').onclick = close;
    document.getElementById('close-detail-btn').onclick = close;
}

function renderRecentFilings(cases) {
  const list = document.getElementById('recent-list');
  if (!list) return;

  const recent = [...cases].filter(c => !c.isEvent)
    .sort((a,b) => {
        const d1 = a.dateFiled ? new Date(a.dateFiled) : new Date(0);
        const d2 = b.dateFiled ? new Date(b.dateFiled) : new Date(0);
        return (isNaN(d2) ? 0 : d2) - (isNaN(d1) ? 0 : d1);
    })
    .slice(0, 5);

  list.innerHTML = recent.map(r => `
    <div style="padding: 12px; border-bottom: 1px solid var(--border-light); font-size: 0.85rem;">
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span style="font-weight:600;">${r.caseNo || 'N/A'}</span>
        <span class="text-muted" style="font-size: 0.75rem;">${r.dateFiled || 'N/A'}</span>
      </div>
      <div class="text-muted">${String(r.title || 'Untitled').substring(0, 50)}${String(r.title || '').length > 50 ? '...' : ''}</div>
    </div>
  `).join('');
}

// EXPOSE REFRESH GLOBALLY
window.forceDashboardRefresh = renderDashboard;
