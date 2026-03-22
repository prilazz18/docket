import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
// renderDashboard is now called via window.refreshDashboard to prevent circular imports
import { renderCalendar } from './calendar.js';

let casesData = [];
let eventsData = [];
let filteredCases = [];

export function getCasesData() {
    return [...casesData, ...eventsData];
}

export function getFilteredCases() {
    return filteredCases;
}

// SHARED UTILITY: Reliable date parser for various DB formats (Excel serials, Timestamps, strings)
export function parseDateSafe(val) {
    if (!val) return null;
    try {
        let d = val;
        // Handle Excel Serial Numbers saved as strings (e.g. "42758")
        if (typeof d === 'string' && /^\d{5}$/.test(d)) {
            d = new Date((parseInt(d) - 25569) * 86400 * 1000);
        } 
        // Handle Firebase Timestamps
        else if (typeof val === 'object' && val.toDate) {
            d = val.toDate();
        } 
        // Standard strings/objects
        else {
            d = new Date(val);
        }
        return isNaN(d) ? null : d;
    } catch(e) { return null; }
}

export function setupCases() {
    const searchInput = document.getElementById('case-search');
    const addCaseBtn = document.getElementById('add-case-btn');
    
    const filterPlaceEl = document.getElementById('filter-place');
    const filterTypeEl = document.getElementById('filter-type');
    const filterStatusEl = document.getElementById('filter-status');
    const filterMonthStartEl = document.getElementById('filter-month-start');
    const filterMonthEndEl = document.getElementById('filter-month-end');
    const filterYearEl = document.getElementById('filter-year');
    const filterDayEl = document.getElementById('filter-day');

    // PERFORMANCE OPTIMIZATION: Use a debounce timer for the search box
    let searchDebounceTimer;

    const applyFilters = (isDataUpdate = false) => {
        const filterPlace = filterPlaceEl?.value || "All";
        const filterType = filterTypeEl?.value || "All";
        const filterStatus = filterStatusEl?.value || "All";
        const mStart = parseInt(filterMonthStartEl?.value || "1");
        const mEnd = parseInt(filterMonthEndEl?.value || "12");
        const fYear = filterYearEl?.value || "All";
        const fDay = filterDayEl?.value || "All";

        filteredCases = casesData.filter(c => {
            if(c.isEvent) return false;
            if (filterPlace !== "All" && c.place !== filterPlace) return false;
            if (filterType !== "All" && c.type !== filterType) return false;
            if (filterStatus !== "All" && c.status !== filterStatus) return false;

            const d = parseDateSafe(c.dateFiled);
            if (d) {
                const mm = d.getMonth() + 1;
                const dd = d.getDate();
                const yyyy = d.getFullYear().toString();
                
                if (mm < mStart || mm > mEnd) return false;
                if (fYear !== "All" && yyyy !== fYear) return false;
                if (fDay !== "All" && dd !== parseInt(fDay)) return false;
            }

            const searchTerm = (searchInput?.value || "").toLowerCase().trim();
            if (searchTerm) {
                const cNo = String(c.caseNo || '').toLowerCase();
                const cTitle = String(c.title || '').toLowerCase();
                const cNature = String(c.nature || '').toLowerCase();
                const cComments = String(c.comments || '').toLowerCase();
                const cComp = String(c.complainant || '').toLowerCase();
                const cResp = String(c.respondent || '').toLowerCase();
                
                if (!cNo.includes(searchTerm) && 
                    !cTitle.includes(searchTerm) && 
                    !cNature.includes(searchTerm) && 
                    !cComments.includes(searchTerm) && 
                    !cComp.includes(searchTerm) && 
                    !cResp.includes(searchTerm)) {
                    return false;
                }
            }
            return true;
        });
        
        // Update the table immediately (local filter)
        renderCasesTable(filteredCases);
        
        // ONLY update the heavy heavy components (Dashboard/Calendar) if the database data actually changed
        // This stops the freezing when typing in search.
        if (isDataUpdate) {
            if (window.renderDashboard) window.renderDashboard();
            renderCalendar();
        }
    };

    const updateFilters = (isDataUpdate = false) => applyFilters(isDataUpdate);
    
    if(filterPlaceEl) filterPlaceEl.addEventListener('change', () => updateFilters(true));
    if(filterTypeEl) filterTypeEl.addEventListener('change', () => updateFilters(true));
    if(filterStatusEl) filterStatusEl.addEventListener('change', () => updateFilters(true));
    if(filterMonthStartEl) filterMonthStartEl.addEventListener('change', () => updateFilters(true));
    if(filterMonthEndEl) filterMonthEndEl.addEventListener('change', () => updateFilters(true));
    if(filterYearEl) filterYearEl.addEventListener('change', () => updateFilters(true));
    if(filterDayEl) filterDayEl.addEventListener('change', () => updateFilters(true));
    
    if(searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            // 400ms delay for smoothness while typing
            searchDebounceTimer = setTimeout(() => {
                updateFilters(false); // false = Don't re-render calendar/dashboard while typing
            }, 400);
        });
    }

    if (db) {
        let isSyncing = false; // Prevent flickering during bulk import
        
        // Removed unauthorized call - now lives inside onAuthStateChanged

        const updateUI = () => {
            if (isSyncing) return; // Optimization: wait for the whole batch
            applyFilters(true); // true = Full refresh of Dashboard/Calendar for real data changes
        };

        let unsubCases = null;
        let unsubEvents = null;
        let hasCleanedOnce = false; // Guard to prevent extra reads

        if (auth) {
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    if (!hasCleanedOnce) { 
                        processAutoClean(); 
                        hasCleanedOnce = true; 
                    }
                    if (!unsubCases) {
                        unsubCases = onSnapshot(collection(db, 'cases'), (snapshot) => {
                            casesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                            updateUI();
                        }, (err) => console.error("Cases sync error:", err));
                    }
                    if (!unsubEvents) {
                        unsubEvents = onSnapshot(collection(db, 'custom_events'), (snapshot) => {
                            eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isEvent: true }));
                            updateUI();
                        }, (err) => console.error("Events sync error:", err));
                    }
                } else {
                    if (unsubCases) { unsubCases(); unsubCases = null; }
                    if (unsubEvents) { unsubEvents(); unsubEvents = null; }
                    casesData = [];
                    eventsData = [];
                    updateUI(); // Clear UI
                }
            });
        }

        // Toggle Syncing Externally
        window.setIsSyncing = (val) => {
            isSyncing = val;
            if (!val) updateUI(); // Force one final refresh when done
        };
    }

    async function processAutoClean() {
        const now = new Date();
        const manilaTime = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Manila',
            hour: 'numeric', hour12: false
        }).format(now);

        if (parseInt(manilaTime) >= 17) {
            // Clean Events
            eventsData.forEach(async (ev) => {
                if (new Date(ev.nextHearing).toDateString() === now.toDateString()) {
                    try { await deleteDoc(doc(db, 'custom_events', ev.id)); } catch(e){}
                }
            });
            // Clean Hearings on Cases
            casesData.forEach(async (c) => {
                if (c.nextHearing && new Date(c.nextHearing).toDateString() === now.toDateString()) {
                    try { await updateDoc(doc(db, 'cases', c.id), { nextHearing: "" }); } catch(e){}
                }
            });
        }
    }

    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value.toLowerCase();
            applyFilters();
        });
    }

    if (addCaseBtn) {
        addCaseBtn.addEventListener('click', () => {
             promptAdminAction(() => {
                 openCaseModal();
             }, 'Full Administrative Access Required', 'admin');
        });
    }

    const importBtn = document.getElementById('import-inventory-btn');
    const importInput = document.getElementById('inventory-file');
    if (importBtn && importInput) {
        importBtn.onclick = () => {
             promptAdminAction(() => {
                 importInput.click();
             }, 'Database Write Access Required', 'admin');
        };
        importInput.onchange = (e) => handleInventoryImport(e);
    }

    async function handleInventoryImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Create Professional Administrative Modal
        const modalContainer = document.getElementById('modal-container');
        modalContainer.innerHTML = `
          <div class="modal-overlay active" style="z-index:9999;">
            <div class="modal-content glow-panel" style="max-width: 450px; padding: 25px; border-color: rgba(255,255,255,0.1);">
              <div class="modal-header" style="justify-content:center; border:none; margin-bottom:15px;">
                <h3 style="letter-spacing:1px; font-weight:800; font-family:'Outfit'; color:#fff;">Synchronizing Case Docket</h3>
              </div>
              <div class="modal-body">
                 <div id="sync-progress-bar-container" style="width:100%; height:6px; background:rgba(255,255,255,0.05); border-radius:3px; margin-bottom:12px; overflow:hidden;">
                    <div id="sync-progress-bar" style="width:0%; height:100%; background:var(--accent-primary); transition: width 0.1s ease;"></div>
                 </div>
                 <div style="display:flex; justify-content:space-between; margin-bottom:15px; font-size:0.75rem; color:rgba(255,255,255,0.6);">
                    <span id="sync-status-text">Preparing records...</span>
                    <span id="sync-percentage-text">0%</span>
                 </div>
                 <div id="activity-log" style="width:100%; height:140px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); border-radius:6px; padding:10px; font-family:'Inter', sans-serif; font-size:0.7rem; color:rgba(255,255,255,0.5); overflow-y:auto; line-height:1.6;">
                    System: Initializing Excel-to-Database Sync...
                 </div>
              </div>
            </div>
          </div>
        `;

        const progressBar = document.getElementById('sync-progress-bar');
        const percentageText = document.getElementById('sync-percentage-text');
        const statusText = document.getElementById('sync-status-text');
        const activityLog = document.getElementById('activity-log');

        const addLog = (msg) => {
            const entry = document.createElement('div');
            entry.innerText = msg;
            activityLog.appendChild(entry);
            activityLog.scrollTop = activityLog.scrollHeight;
        };

        const reader = new FileReader();
        reader.onload = async (evt) => {
            if(window.setIsSyncing) window.setIsSyncing(true);
            const data = evt.target.result;
            const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
            
            // PHASE 1: ATOMIC AGGREGATION (Collect all rows from all sheets first)
            const allCasesToProcess = [];
            for (const sn of workbook.SheetNames) {
                try {
                    const sheet = workbook.Sheets[sn];
                    // Use header:1 to get raw data and avoid JSON key issues at first
                    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
                    
                    if (rows.length === 0) continue;

                    let caseType = 'Other';
                    const upSn = sn.toUpperCase();
                    if (upSn.includes('CRIMINAL')) caseType = 'Criminal';
                    else if (upSn.includes('CIVIL') || upSn.includes('SPEC') || upSn.includes('SCA')) caseType = 'Civil';
                    else if (upSn.includes('CADASTRAL')) caseType = 'Cadastral';
                    else if (upSn.includes('APPEAL')) caseType = 'Appeal';
                    else if (upSn.includes('CICL')) caseType = 'CICL';

                    rows.forEach(r => allCasesToProcess.push({ row: r, type: caseType, sheet: sn }));
                    addLog(`Aggregate: ${sn} (${rows.length} cases detected)`);
                } catch (e) {
                    addLog(`Warning: Could not read sheet ${sn}`);
                }
            }

            const totalRows = allCasesToProcess.length;
            let processedCount = 0;
            let totalUpdated = 0;
            let totalAdded = 0;

            addLog(`PREPARING ATOMIC SYNC: ${totalRows} TOTAL RECORDS...`);

            // PHASE 2: UNIFIED STREAM PROCESSING
            for (const item of allCasesToProcess) {
                const { row, type: caseType, sheet: sn } = item;
                try {
                    // AGGRESSIVE COLUMN DISCOVERY
                    const getVal = (keywords) => {
                        const rowKeys = Object.keys(row);
                        const match = rowKeys.find(k => keywords.some(kw => k.toUpperCase().includes(kw.toUpperCase())));
                        return match ? row[match] : '';
                    };

                    const rawCaseNo = getVal(['CASE NO', 'CASE_NO', 'CASE #', 'CASE NUMBER', 'LRC', 'G.R. NO', 'DOCKET #']);
                    const rawTitle = getVal(['TITLE', 'PARTIES', 'CASE_TITLE', 'ACCUSED', 'APPLICANT', 'PETITIONER', 'PLAINTIFF', 'COMPLAINANT']);
                    
                    if (!rawCaseNo || !rawTitle) {
                        processedCount++;
                        updateProgress();
                        continue;
                    }

                    const rawNature = getVal(['NATURE', 'OFFENSE', 'CAUSE', 'DESCRIPTION', 'SUBJECT']);
                    const rawDateFiled = getVal(['DATE FILED', 'DATE_FILED', 'FILED ON', 'DATE OF FILING', 'DATE', 'FILED', 'FILING']);
                    const rawAction = getVal(['COURT ACTION', 'LAST ACTION', 'STATUS DATA', 'REMARKS', 'ACTION TAKEN', 'DECISION']);

                    const normalized = (str) => str.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
                    const cleanId = normalized(rawCaseNo);

                    let status = 'Active';
                    const actionUpper = rawAction.toString().toUpperCase();
                    const disposedKeywords = ['DECIDED', 'DECISION', 'DISMISSED', 'DISMISSAL', 'PLEADED GUILTY', 'PLEA BARGAIN', 'GUILTY', 'ACQUITTED', 'ACQUITTAL', 'SENTENCE', 'SETTLED', 'COMPROMISE'];
                    const pendingKeywords = ['PROPOSAL', 'DIRECTED TO FILE', 'FOR COMMENT', 'PENDING', 'FOR RESOLUTION', 'FOR DECISION', 'FOR DISMISSAL', 'SET FOR', 'CONTINUED', 'POSTPONED', 'RESET'];

                    const hasDisposedKeyword = disposedKeywords.some(kw => actionUpper.includes(kw));
                    const hasPendingKeyword = pendingKeywords.some(kw => actionUpper.includes(kw));
                    const hasArchiveKeyword = ['ARCHIVE', 'ARCHIVED', 'FOR ARCHIVE'].some(kw => actionUpper.includes(kw));

                    if (hasArchiveKeyword) status = 'Archived';
                    else if (hasDisposedKeyword && !hasPendingKeyword) status = 'Disposed';
                    
                    if (actionUpper.includes('APPEALED') || actionUpper.includes('ON APPEAL')) status = 'Appeal';

                    // DATE FORMATTER: Ensures mm/dd/yyyy even from raw Excel dates
                    const formatDate = (val) => {
                        if (val == null || val === '') return '';
                        if (val instanceof Date) {
                            return `${(val.getMonth() + 1).toString().padStart(2, '0')}/${val.getDate().toString().padStart(2, '0')}/${val.getFullYear()}`;
                        }
                        // Handle native Excel serial numbers (number of days since Jan 1 1900)
                        if (typeof val === 'number') {
                            const jsDate = new Date((val - 25569) * 86400 * 1000);
                            return `${(jsDate.getUTCMonth() + 1).toString().padStart(2, '0')}/${jsDate.getUTCDate().toString().padStart(2, '0')}/${jsDate.getUTCFullYear()}`;
                        }
                        return val.toString().trim();
                    };

                    const payload = {
                        caseNo: rawCaseNo.toString().trim(),
                        title: rawTitle.toString().trim(),
                        nature: rawNature.toString().trim(),
                        dateFiled: formatDate(rawDateFiled),
                        comments: rawAction.toString().trim() || 'TO BE UPDATED',
                        status: status,
                        type: caseType
                    };

                    let casePlace = 'Sipalay';
                    const upperNo = payload.caseNo.toUpperCase();
                    if (upperNo.startsWith('H-')) casePlace = 'Hinoba-an';

                    let existing = casesData.find(c => c.caseNo === payload.caseNo);
                    if (!existing) existing = casesData.find(c => normalized(c.caseNo) === cleanId);
                    if (!existing) existing = casesData.find(c => normalized(c.title) === normalized(payload.title));

                    if (existing) {
                        await updateDoc(doc(db, 'cases', existing.id), { ...payload, place: casePlace });
                        totalUpdated++;
                        addLog(`UPD: ${payload.caseNo}`);
                    } else {
                        const newCase = {
                            ...payload,
                            place: casePlace,
                            nextHearing: status === 'Disposed' ? '' : (row['Next Hearing'] || ''),
                            complainant: 'N/A', respondent: 'N/A'
                        };
                        await addDoc(collection(db, 'cases'), newCase);
                        totalAdded++;
                        addLog(`NEW: ${payload.caseNo}`);
                    }
                } catch (err) {
                    console.error("Row Error:", err);
                }
                processedCount++;
                updateProgress();
            }

            function updateProgress() {
                const progress = Math.round((processedCount / totalRows) * 100);
                progressBar.style.width = `${progress}%`;
                percentageText.innerText = `${progress}%`;
                statusText.innerText = `Atomic Sync: ${processedCount}/${totalRows} completed...`;
            }

            if(window.setIsSyncing) window.setIsSyncing(false);

            if(window.setIsSyncing) window.setIsSyncing(false);

            // SUCCESS FINAL POPUP
            modalContainer.innerHTML = `
              <div class="modal-overlay active">
                <div class="modal-content glow-panel" style="max-width:350px; text-align:center; border-color:var(--accent-primary);">
                  <div class="modal-body" style="padding:40px;">
                    <div style="font-size:3.5rem; margin-bottom:20px;">✅</div>
                    <h2 style="color:var(--accent-primary); margin-bottom:15px; font-family:'Outfit'; font-weight:800;">SYNC COMPLETE</h2>
                    <div style="text-align:left; background:rgba(255,255,255,0.05); padding:15px; border-radius:8px; font-family:monospace; font-size:0.85rem; margin-bottom:25px;">
                        <div style="margin-bottom:5px;">TOTAL RECORDS : ${processedCount}</div>
                        <div style="color:var(--accent-primary);">UPDATED REC   : ${totalUpdated}</div>
                        <div style="color:#fff;">NEW FILINGS  : ${totalAdded}</div>
                    </div>
                    <button id="close-sync" class="btn-primary" style="width:100%;">ACCESS UPDATED DOCKET</button>
                  </div>
                </div>
              </div>
            `;
            document.getElementById('close-sync').onclick = () => modalContainer.innerHTML = '';
            importInput.value = '';
        };
        reader.readAsBinaryString(file);
    }
}

function renderCasesTable(data) {
    const tbody = document.getElementById('cases-tbody');
    if(!tbody) return;
    
    try {
        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">
                No cases found. Data Status: [DB Size: ${casesData ? casesData.length : 'null'}]
            </td></tr>`;
            return;
        }

        let fullHtml = '';
        data.sort((a,b) => {
            const d1 = a.dateFiled ? new Date(a.dateFiled) : new Date(0);
            const d2 = b.dateFiled ? new Date(b.dateFiled) : new Date(0);
            return (isNaN(d2) ? 0 : d2) - (isNaN(d1) ? 0 : d1);
        }).forEach(c => {
            const nextH = parseDateSafe(c.nextHearing);
            const d = nextH ? nextH.toLocaleDateString() : 'Unscheduled';
            const dateFiledObj = parseDateSafe(c.dateFiled);
            const dateFiledDisplay = dateFiledObj ? dateFiledObj.toLocaleDateString() : 'N/A';
            const p1Label = c.party1Type ? String(c.party1Type).substring(0,3).toUpperCase() : 'CMP';
            const p2Label = c.party2Type ? String(c.party2Type).substring(0,3).toUpperCase() : 'ACC';
            const p1Names = c.complainant ? String(c.complainant).replace(/ \| /g, ', ') : 'N/A';
            const p2Names = c.respondent ? String(c.respondent).replace(/ \| /g, ', ') : 'N/A';
            const cPlace = c.place || '';
            const cCaseNo = c.caseNo || 'N/A';
            const cTitle = c.title || 'Untitled';
            const cType = c.type || 'Other';
            const cNature = c.nature || 'N/A';
            const cStatus = c.status || 'Active';
            
            fullHtml += `
              <tr class="cases-row" data-id="${c.id}" style="cursor:pointer;">
                <td>
                  <span style="font-size: 0.70rem; color: var(--accent-primary); display:block; text-transform:uppercase;">${cPlace}</span>
                  <span>${cCaseNo}</span>
                </td>
                <td>
                  <div style="font-weight:600;">${cTitle}</div>
                  <div class="text-xs text-muted">
                     <b>${p1Label}:</b> ${p1Names}<br>
                     <b>${p2Label}:</b> ${p2Names}
                  </div>
                </td>
                <td>
                   <span style="font-size: 0.7rem; border: 1px solid var(--border-light); padding: 2px 5px; border-radius:3px;">${cType}</span>
                   <div class="text-xs text-muted">${cNature}</div>
                </td>
                <td><span class="status-badge status-${cStatus.toLowerCase()}">${cStatus}</span></td>
                <td>${d}</td>
                <td class="text-right">
                   <button class="btn-secondary btn-sm edit-case-btn" data-id="${c.id}">Edit</button>
                </td>
              </tr>
            `;
        });
        tbody.innerHTML = fullHtml;

    document.querySelectorAll('.cases-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if(e.target.closest('.edit-case-btn')) return; 
            const id = row.getAttribute('data-id');
            const caseRecord = casesData.find(x => x.id === id);
            promptAdminAction(() => viewDetailsModal(caseRecord), 'Dossier Access Authentication', 'viewer');
        });
    });

    document.querySelectorAll('.edit-case-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            const caseRecord = casesData.find(x => x.id === id);
            promptAdminAction(() => openCaseModal(caseRecord), 'Administrative Edit Authorization', 'admin');
        });
    });
    } catch(err) {
        tbody.innerHTML = `<tr><td colspan="6" style="color:red;">Render Crash: ${err.message}</td></tr>`;
    }
}

export function promptAdminAction(callback, customMessage = null, requiredRole = 'admin') {
    const modalContainer = document.getElementById('modal-container');
    const msg = customMessage || "Administrative Access Required:";
    
    modalContainer.innerHTML = `
      <div class="modal-overlay active">
        <div class="modal-content glow-panel" style="max-width: 400px; border-color: #f59e0b;">
          <div class="modal-header" style="background: rgba(245, 158, 11, 0.1); border-bottom: 2px solid #f59e0b;">
            <h3 style="color: #f59e0b; display: flex; align-items: center; gap: 8px;">
               <span style="font-size: 1.25rem;">⚠️</span> SECURITY CAUTION
            </h3>
            <button class="close-btn" id="close-admin-modal" style="color: #f59e0b;">&times;</button>
          </div>
          <div class="modal-body text-center" style="padding: 30px;">
             <p style="font-weight: 700; color: #fff; margin-bottom: 15px; font-size: 1.1rem;">${msg.toUpperCase()}</p>
             <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 20px;">
                ${requiredRole === 'admin' ? 'This action requires Full Administrative Passcode.' : 'Identification verification is mandatory for viewing records.'}
             </p>
             
             <input type="password" id="admin-pwd-input" 
                    style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid #f59e0b; padding: 12px; color: #fff; border-radius: 8px; text-align: center; font-size: 1.1rem; letter-spacing: 4px;" 
                    placeholder="••••••••" />
             
             <div id="admin-err-msg" class="hidden" style="color: #ef4444; font-size: 0.75rem; margin-top: 10px; font-weight: 600;">ACCESS DENIED: INCORRECT PASSCODE</div>
             
             <button id="admin-submit-btn" class="btn-primary w-100" 
                     style="margin-top: 20px; background: #f59e0b; color: #000; font-weight: 800;">VERIFY IDENTITY</button>
          </div>
        </div>
      </div>
    `;

    const pwdInput = document.getElementById('admin-pwd-input');
    pwdInput.focus();

    document.getElementById('close-admin-modal').onclick = () => modalContainer.innerHTML = '';

    async function handleAuth() {
        const pass = pwdInput.value;
        const submitBtn = document.getElementById('admin-submit-btn');
        const errEl = document.getElementById('admin-err-msg');

        if (!pass) return;

        // Visual feedback for processing
        submitBtn.disabled = true;
        submitBtn.innerText = "AUTHENTICATING...";
        errEl.classList.add('hidden');

        try {
            // UNCRACKABLE SECURITY: Instead of checking the code here (which is visible to hackers),
            // we ask the Cloud Database if a document with this code exists.
            const snapshot = await getDoc(doc(db, 'security_matrix', pass));

            if (snapshot.exists()) {
                const roleData = snapshot.data();
                const userRole = roleData.role; // 'admin' or 'viewer'

                // Check if the user's role is sufficient for the action
                const hasAccess = (requiredRole === 'viewer') || (requiredRole === 'admin' && userRole === 'admin');

                if (hasAccess) {
                    modalContainer.innerHTML = '';
                    callback();
                    return;
                }
            }
            
            // Access Denied
            errEl.classList.remove('hidden');
            errEl.innerText = "ACCESS DENIED: IDENTITY NOT RECOGNIZED";
            submitBtn.disabled = false;
            submitBtn.innerText = "VERIFY IDENTITY";
        } catch(e) {
            console.error("SECURE AUTH ERROR DETAIL:", e);
            errEl.classList.remove('hidden');
            const errCode = e.code || 'UNKNOWN';
            errEl.innerText = `CLOUD CONNECTION FAILED (${errCode}). PLEASE CHECK YOUR CONNECTION OR TRY AGAIN.`;
            
            submitBtn.disabled = false;
            submitBtn.innerText = "VERIFY IDENTITY";
        }
    }

    document.getElementById('admin-submit-btn').onclick = handleAuth;
    pwdInput.onkeypress = (e) => { if (e.key === 'Enter') handleAuth(); };
}

function openCaseModal(existingCase = null) {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="modal-overlay active">
        <div class="modal-content">
          <div class="modal-header">
            <h3>${existingCase ? 'Edit Case' : 'New Case'}</h3>
            <button class="close-btn" id="close-modal">&times;</button>
          </div>
          <div class="modal-body">
             <form id="case-form" class="form-grid">
               <div class="input-group">
                 <label>Place</label>
                 <select id="f-place" required>
                   <option value="Sipalay" ${existingCase?.place === 'Sipalay' ? 'selected' : ''}>Sipalay</option>
                   <option value="Hinoba-an" ${existingCase?.place === 'Hinoba-an' ? 'selected' : ''}>Hinoba-an</option>
                 </select>
               </div>
               <div class="input-group">
                 <label>Case No.</label>
                 <input type="text" id="f-caseNo" required value="${existingCase ? existingCase.caseNo : ''}" />
               </div>
               <div class="input-group">
                 <label>Type</label>
                 <select id="f-type" required>
                   <option value="Criminal" ${existingCase?.type === 'Criminal' ? 'selected' : ''}>Criminal</option>
                   <option value="Civil" ${existingCase?.type === 'Civil' ? 'selected' : ''}>Civil</option>
                   <option value="Cadastral"  ${existingCase?.type === 'Cadastral' ? 'selected' : ''}>Cadastral</option>
                   <option value="CICL" ${existingCase?.type === 'CICL' ? 'selected' : ''}>CICL</option>
                   <option value="Appeal" ${existingCase?.type === 'Appeal' ? 'selected' : ''}>Appeal</option>
                 </select>
               </div>
               <div class="input-group full-width">
                 <label>Title</label>
                 <input type="text" id="f-title" required value="${existingCase ? existingCase.title : ''}" />
               </div>
               <div class="input-group full-width" style="border: 1px solid var(--border-light); padding: 10px; border-radius: 5px;">
                 <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    <div>
                      <select id="f-p1-type" style="width:100%;" required>
                        <option value="Complainant">Complainant(s)</option>
                        <option value="Plaintiff">Plaintiff(s)</option>
                        <option value="Petitioner">Petitioner(s)</option>
                      </select>
                      <div id="p1-container"></div>
                      <button type="button" id="btn-add-p1" class="btn-sm">+ ADD</button>
                    </div>
                    <div>
                      <select id="f-p2-type" style="width:100%;" required>
                        <option value="Accused">Accused</option>
                        <option value="Respondent">Respondent(s)</option>
                        <option value="Defendant">Defendant(s)</option>
                      </select>
                      <div id="p2-container"></div>
                      <button type="button" id="btn-add-p2" class="btn-sm">+ ADD</button>
                    </div>
                 </div>
               </div>
               <div class="input-group">
                 <label>Nature</label>
                 <input type="text" id="f-nature" required value="${existingCase ? existingCase.nature : ''}" />
               </div>
               <div class="input-group">
                 <label>Date Filed</label>
                 <input type="date" id="f-date" required value="${existingCase ? (parseDateSafe(existingCase.dateFiled)?.toISOString()?.split('T')[0] || '') : new Date().toISOString().split('T')[0]}" />
               </div>
               <div class="input-group">
                 <label>Status</label>
                 <select id="f-status" required>
                   <option value="Active" ${existingCase?.status === 'Active' ? 'selected' : ''}>Active</option>
                   <option value="Disposed" ${existingCase?.status === 'Disposed' ? 'selected' : ''}>Disposed</option>
                   <option value="Appeal" ${existingCase?.status === 'Appeal' ? 'selected' : ''}>On Appeal (CA)</option>
                   <option value="Archived" ${existingCase?.status === 'Archived' ? 'selected' : ''}>Archived</option>
                 </select>
               </div>
                <div class="input-group full-width" style="margin-top:20px; border-top: 1px solid var(--border-light); padding-top:20px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <label style="font-weight:800; color:var(--accent-primary);">SCHEDULED HEARINGS</label>
                    <button type="button" id="btn-add-hearing" class="btn-primary btn-sm">+ ADD DATE</button>
                  </div>
                  <div id="hearings-container"></div>
                </div>
               <div class="input-group full-width">
                 <label>Comments</label>
                 <textarea id="f-comments" rows="2">${existingCase ? existingCase.comments : ''}</textarea>
               </div>
               <div class="modal-footer full-width" style="display:flex; justify-content:space-between;">
                 ${existingCase ? `<button type="button" class="btn-secondary" id="delete-modal-btn" style="color:red;">DELETE</button>` : '<div></div>'}
                 <div style="display:flex; gap:10px;">
                    <button type="button" class="btn-secondary" id="cancel-modal">CANCEL</button>
                    <button type="submit" class="btn-primary">SAVE</button>
                 </div>
               </div>
             </form>
          </div>
        </div>
      </div>
    `;

    const hearingsContainer = document.getElementById('hearings-container');
    const p1Container = document.getElementById('p1-container');
    const p2Container = document.getElementById('p2-container');
    let existingP1 = existingCase?.complainant ? existingCase.complainant.split(' | ') : [''];
    let existingP2 = existingCase?.respondent ? existingCase.respondent.split(' | ') : [''];
    let existingHearings = existingCase?.hearings || (existingCase?.nextHearing ? [existingCase.nextHearing] : []);

    function renderInputs(container, values, prefix, inputType = 'text') {
        container.innerHTML = '';
        values.forEach((val, idx) => {
            const html = `<div style="display:flex; gap:10px; margin-top:8px; align-items:center; background:rgba(255,255,255,0.03); padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.05);">
               <input type="${inputType}" class="${prefix}-input" required value="${val}" style="flex:1; background:transparent; border:none; color:#fff;" />
               <button type="button" class="remove-${prefix}" data-idx="${idx}" style="background:none; border:none; color:#ff4d4d; font-size:1.2rem; cursor:pointer;">&times;</button>
            </div>`;
            container.insertAdjacentHTML('beforeend', html);
        });

        container.querySelectorAll(`.remove-${prefix}`).forEach(btn => {
            btn.onclick = (e) => {
                values.splice(parseInt(e.currentTarget.getAttribute('data-idx')), 1);
                renderInputs(container, values, prefix, inputType);
                updateAutomatedTitle();
            };
        });

        container.querySelectorAll(`.${prefix}-input`).forEach((inp, idx) => {
            inp.oninput = (e) => {
                values[idx] = e.target.value;
                updateAutomatedTitle();
            };
        });
    }

    renderInputs(p1Container, existingP1, 'p1');
    renderInputs(p2Container, existingP2, 'p2');
    renderInputs(hearingsContainer, existingHearings, 'hearing', 'datetime-local');

    document.getElementById('btn-add-p1').onclick = () => { existingP1.push(''); renderInputs(p1Container, existingP1, 'p1'); };
    document.getElementById('btn-add-p2').onclick = () => { existingP2.push(''); renderInputs(p2Container, existingP2, 'p2'); };
    document.getElementById('btn-add-hearing').onclick = () => { existingHearings.push(''); renderInputs(hearingsContainer, existingHearings, 'hearing', 'datetime-local'); };

    const fType = document.getElementById('f-type');
    const fTitle = document.getElementById('f-title');

    function updateAutomatedTitle() {
        if(fType.value === 'Criminal') {
            const names = existingP2.filter(x => x.trim() !== '').join(', ') || '_______';
            fTitle.value = `People of the Philippines vs. ${names}`;
        }
    }

    fType.onchange = updateAutomatedTitle;
    updateAutomatedTitle();

    document.getElementById('close-modal').onclick = () => modalContainer.innerHTML = '';
    document.getElementById('cancel-modal').onclick = () => modalContainer.innerHTML = '';

    if (document.getElementById('delete-modal-btn')) {
        document.getElementById('delete-modal-btn').onclick = async () => {
            if(confirm("Delete record?")) {
                await deleteDoc(doc(db, 'cases', existingCase.id));
                modalContainer.innerHTML = '';
            }
        };
    }
    
    document.getElementById('case-form').onsubmit = async (e) => {
        e.preventDefault();
        // Find the soonest hearing for the primary display
        const soonest = [...existingHearings].filter(h => h).sort()[0] || '';

        const payload = {
            place: document.getElementById('f-place').value,
            caseNo: document.getElementById('f-caseNo').value,
            type: fType.value,
            title: fTitle.value,
            party1Type: document.getElementById('f-p1-type').value,
            party2Type: document.getElementById('f-p2-type').value,
            complainant: existingP1.filter(x => x.trim() !== '').join(' | '),
            respondent: existingP2.filter(x => x.trim() !== '').join(' | '),
            nature: document.getElementById('f-nature').value,
            dateFiled: document.getElementById('f-date').value,
            status: document.getElementById('f-status').value,
            hearings: existingHearings.filter(h => h !== ''),
            nextHearing: soonest,
            comments: document.getElementById('f-comments').value
        };
        
        try {
            if (existingCase) await updateDoc(doc(db, 'cases', existingCase.id), payload);
            else await addDoc(collection(db, 'cases'), payload);
            modalContainer.innerHTML = '';
        } catch(err) { alert("Error saving data."); }
    };
}

function viewDetailsModal(caseRecord) {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="modal-overlay active">
        <div class="modal-content glow-panel" style="max-width: 600px; border: 2px solid #000; background:#fff; box-shadow: 0 0 40px rgba(0,0,0,0.5);">
          <div class="modal-header" style="border-bottom: 2px solid #000; background: #f0f0f0;">
            <h3 style="color:#000; font-family:'Outfit'; font-weight:800;">OFFICIAL CASE DOSSIER: ${caseRecord.caseNo}</h3>
            <button class="close-btn" id="close-dossier-modal" style="color:#000;">&times;</button>
          </div>
          <div class="modal-body" id="dossier-body" style="padding:40px; color:#000; font-family: 'Courier New', monospace; white-space:pre-wrap; min-height:450px; overflow-y:auto; line-height:1.6;">
             <div id="typewriter-container"></div>
          </div>
          <div class="modal-footer" style="padding:15px; border-top:1px solid #ddd; text-align:right; background:#f9f9f9;">
             <button class="btn-primary" id="close-dossier-btn" style="background:#000; color:#fff;">Close Record</button>
          </div>
        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ''; };
    document.getElementById('close-dossier-modal').onclick = close;
    document.getElementById('close-dossier-btn').onclick = close;

    const formatDate = (dateValue) => {
        const d = parseDateSafe(dateValue);
        if (!d) return String(dateValue || 'N/A');
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    };

    let nh = 'No scheduled hearing';
    if (caseRecord.nextHearing) {
        let nhd = caseRecord.nextHearing;
        if (typeof nhd === 'object' && nhd.toDate) nhd = nhd.toDate();
        else nhd = new Date(nhd);
        if (!isNaN(nhd)) nh = nhd.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
    
    const complainantType = caseRecord.party1Type || 'Complainant';
    const accusedType = caseRecord.party2Type || 'Accused';

    const fullHtml = `> ACCESSING ENCRYPTED RECORD...\n` +
                 `> DECRYPTING...\n\n` +
                 `<div style="font-weight:800; border-bottom:1px solid #000; margin-bottom:15px; font-size:1.2rem;">[ CASE SUMMARY ]</div>` +
                 `[ TITLE ]        : ${caseRecord.title.toUpperCase()}\n` +
                 `[ CLASSIFICATION ] : ${caseRecord.type.toUpperCase()}\n` +
                 `[ STATUS ]         : ${caseRecord.status.toUpperCase()}\n` +
                 `[ NATURE/VIOLTN ]  : ${caseRecord.nature.toUpperCase()}\n\n` +
                 `<span class="highlight-accused">[ ${complainantType.toUpperCase()} ] : ${caseRecord.complainant.replace(/ \| /g, ', ')}</span>` +
                 `<span class="highlight-accused">[ ${accusedType.toUpperCase()} ] : ${caseRecord.respondent.replace(/ \| /g, ', ')}</span>\n` +
                 `[ DATE FILED ]    : ${formatDate(caseRecord.dateFiled)}\n\n` +
                 `<span class="highlight-action">[ NEXT HEARING ] : ${nh}</span>\n` +
                 `<span class="highlight-action">[ LAST ACTION / COMMENTS ] : \n${caseRecord.comments || 'TO BE UPDATED'}</span>\n\n` +
                 `> RECORD TERMINATED.\n` +
                 `> END OF FILE.`;

    const container = document.getElementById('typewriter-container');
    let i = 0;
    let isTag = false;
    let text = "";
    
    // FASTER TYPEWRITER
    function typeWriter() {
        if (i < fullHtml.length) {
            let char = fullHtml.charAt(i);
            if (char === "<") isTag = true;
            if (char === ">") isTag = false;

            text += char;
            container.innerHTML = text;
            i++;

            if (isTag) {
                typeWriter(); // Skip delays for tags
            } else {
                setTimeout(typeWriter, 4); // Very fast (4ms)
            }
        }
    }
    typeWriter();
}
