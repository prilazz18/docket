import { getCasesData, promptAdminAction } from './cases.js';
import { db } from './firebase-config.js';
import { collection, addDoc, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
// renderDashboard is now called via window.renderDashboard to prevent circular imports

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

export function initCalendar() {
  const prevMonth = document.getElementById('prev-month');
  const nextMonth = document.getElementById('next-month');
  const prevYear = document.getElementById('prev-year');
  const nextYear = document.getElementById('next-year');

  if (prevMonth) prevMonth.onclick = () => { currentMonth--; if(currentMonth < 0){ currentMonth=11; currentYear--; } renderCalendar(); };
  if (nextMonth) nextMonth.onclick = () => { currentMonth++; if(currentMonth > 11){ currentMonth=0; currentYear++; } renderCalendar(); };
  if (prevYear) prevYear.onclick = () => { currentYear--; renderCalendar(); };
  if (nextYear) nextYear.onclick = () => { currentYear++; renderCalendar(); };

  const addEventBtn = document.getElementById('add-event-btn');
  if (addEventBtn) {
    addEventBtn.onclick = () => {
        promptAdminAction(() => openAddEventModal());
    };
  }

  renderCalendar();
}

export function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  const monthYearLabel = document.getElementById('calendar-month-year');
  if (!grid || !monthYearLabel) return;

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  monthYearLabel.innerText = `${monthNames[currentMonth]} ${currentYear}`;

  const dayLabels = grid.querySelectorAll('.day-name');
  grid.innerHTML = '';
  dayLabels.forEach(d => grid.appendChild(d));

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day empty';
    grid.appendChild(empty);
  }

  const allCases = getCasesData();
  for (let day = 1; day <= daysInMonth; day++) {
    const dayEl = document.createElement('div');
    dayEl.className = 'cal-day';
    
    const now = new Date();
    if(day === now.getDate() && currentMonth === now.getMonth() && currentYear === now.getFullYear()) {
        dayEl.classList.add('today-glow');
    }

    dayEl.innerHTML = `<span class="date-num">${day}</span>`;

    const dayEvents = [];
    allCases.forEach(c => {
       // Legacy single date support
       if (c.nextHearing) {
          const nh = new Date(c.nextHearing);
          if (!isNaN(nh) && nh.toDateString() === new Date(currentYear, currentMonth, day).toDateString()) {
              dayEvents.push({ ...c, activeDate: c.nextHearing });
          }
       }
       // New Multiple Hearings support
       if (c.hearings && Array.isArray(c.hearings)) {
          c.hearings.forEach(h => {
             // Avoid duplication if nextHearing and hearings share the same entry
             if (h === c.nextHearing) return; 
             const nh = new Date(h);
             if (!isNaN(nh) && nh.toDateString() === new Date(currentYear, currentMonth, day).toDateString()) {
                 dayEvents.push({ ...c, activeDate: h });
             }
          });
       }
    });

    dayEvents.sort((a,b) => {
        const d1 = new Date(a.activeDate);
        const d2 = new Date(b.activeDate);
        return (isNaN(d1) ? 0 : d1) - (isNaN(d2) ? 0 : d2);
    });

    dayEvents.slice(0, 2).forEach(ev => {
       const indicator = document.createElement('div');
       indicator.className = 'event-indicator';
       if(ev.isEvent) indicator.style.background = '#f59e0b';
       indicator.innerText = ev.title || 'Untitled';
       dayEl.appendChild(indicator);
    });

    if (dayEvents.length > 2) {
       const more = document.createElement('div');
       more.style.fontSize = '0.6rem';
       more.style.color = 'var(--accent-primary)';
       more.style.textAlign = 'center';
       more.innerText = `+${dayEvents.length - 2} more`;
       dayEl.appendChild(more);
    }

    dayEl.onclick = () => showDayModal(currentYear, currentMonth, day, dayEvents);
    grid.appendChild(dayEl);
  }
}

function showDayModal(year, month, day, events) {
  const modalContainer = document.getElementById('modal-container');
  const dateStr = new Date(year, month, day).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
  modalContainer.innerHTML = `
    <div class="modal-overlay active">
      <div class="modal-content glow-panel" style="max-width: 500px;">
        <div class="modal-header">
          <h3>Agenda: ${dateStr}</h3>
          <button class="close-btn" id="close-cal-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div id="day-events-list" style="max-height: 400px; overflow-y: auto; margin-bottom: 20px;">
             ${events.length === 0 ? '<p class="text-muted text-center py-4">No scheduled hearings or events.</p>' : 
               events.map(ev => `
                 <div class="list-item" style="padding: 12px; border-bottom: 1px solid var(--border-light); display:flex; gap:12px; align-items:center;">
                    <div style="background:rgba(255,255,255,0.05); padding: 5px 10px; border-radius: 4px; font-weight:700; color:var(--accent-primary); font-size: 0.8rem; min-width:80px; text-align:center;">
                       ${new Date(ev.activeDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                    <div style="flex:1;">
                       <div style="font-weight:600; font-size: 0.95rem; margin-bottom: 2px;">${ev.title}</div>
                       <div style="font-size: 0.75rem; color:var(--text-muted);">${ev.isEvent ? 'Custom Event' : ev.caseNo}</div>
                    </div>
                    <button class="btn-secondary btn-sm delete-ev-btn" data-id="${ev.id}" data-date="${ev.activeDate}" style="color:red; border-color:rgba(255,0,0,0.2);">Delete</button>
                 </div>
               `).join('')
             }
          </div>
          <div style="display:flex; justify-content:flex-end;">
             ${events.length > 0 ? `<button id="print-schedule-btn" class="btn-primary" style="font-size: 0.85rem;">🖨️ Print Schedule (PDF)</button>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('close-cal-modal').onclick = () => modalContainer.innerHTML = '';

  document.querySelectorAll('.delete-ev-btn').forEach(btn => {
      btn.onclick = (e) => {
          const targetId = e.currentTarget.getAttribute('data-id'); 
          const targetDate = e.currentTarget.getAttribute('data-date'); 
          const allData = getCasesData();
          const targetEntry = allData.find(x => x.id === targetId);
          
          if (!targetId || !targetEntry) {
              alert("Wait: Entry not found in local cache. Please wait or refresh.");
              return;
          }

          const showDeleteConfirm = () => {
            const deleteModal = document.createElement('div');
            deleteModal.className = 'modal-overlay active';
            deleteModal.style.zIndex = '3000';
            deleteModal.innerHTML = `
              <div class="modal-content glow-panel" style="max-width: 400px; text-align: center; border-color: var(--accent-secondary);">
                <div class="modal-header">
                  <h3 style="color: var(--accent-secondary);">Delete Confirmation</h3>
                  <button class="close-btn" id="close-delete-modal">&times;</button>
                </div>
                <div class="modal-body" style="padding: 30px;">
                   <div style="font-size: 3rem; margin-bottom: 20px;">🗑️</div>
                   <p style="margin-bottom: 25px; color: var(--text-main); font-weight: 500;">Remove this schedule [${new Date(targetDate).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}]?</p>
                   <div style="display: flex; gap: 15px; justify-content: center;">
                      <button id="cancel-delete" class="btn-secondary" style="flex: 1;">Keep it</button>
                      <button id="confirm-delete" class="btn-primary" style="flex: 1; background: var(--accent-secondary); color: #fff;">Remove Date</button>
                   </div>
                </div>
              </div>
            `;
            modalContainer.appendChild(deleteModal);
            
            const closeDel = () => deleteModal.remove();
            document.getElementById('close-delete-modal').onclick = closeDel;
            document.getElementById('cancel-delete').onclick = closeDel;
            document.getElementById('confirm-delete').onclick = async () => {
                 try {
                     // OPTIMISTIC UI: Instantly hide the item from view for smoothness
                     const itemToRemove = document.querySelector(`.delete-ev-btn[data-date="${targetDate}"][data-id="${targetId}"]`)?.closest('.list-item');
                     if (itemToRemove) itemToRemove.style.opacity = '0.3', itemToRemove.style.pointerEvents = 'none';

                     const showSuccess = () => {
                         const successModal = document.createElement('div');
                         successModal.className = 'modal-overlay active';
                         successModal.style.zIndex = '4000';
                         successModal.innerHTML = `
                           <div class="modal-content glow-panel" style="max-width: 350px; text-align: center; border-color: var(--accent-primary);">
                             <div class="modal-body" style="padding: 40px;">
                                <div style="font-size: 4rem; margin-bottom: 20px; color: var(--accent-primary);">✅</div>
                                <h2 style="color: var(--accent-primary); margin-bottom: 10px; font-family: 'Outfit';">REMOVED</h2>
                                <p style="color: var(--text-main); font-size: 0.9rem;">The hearing schedule was successfully updated.</p>
                                <button id="ok-success" class="btn-primary" style="margin-top: 25px; width: 100%;">DONE</button>
                             </div>
                           </div>
                         `;
                         modalContainer.appendChild(successModal);
                         document.getElementById('ok-success').onclick = () => {
                             successModal.remove();
                             modalContainer.innerHTML = ''; // Full clear ONLY when user hits DONE
                         };
                         setTimeout(() => { if(successModal.parentNode) successModal.remove(); if(modalContainer.innerHTML.includes('REMOVED')) modalContainer.innerHTML = ''; }, 2000); 
                     };

                     closeDel(); // Close confirmation modal immediately

                     if (targetEntry.isEvent) {
                         await deleteDoc(doc(db, 'custom_events', targetId));
                     } else {
                         const oldHearings = targetEntry.hearings || [];
                         const newHearings = oldHearings.filter(h => h !== targetDate);
                         const soonest = [...newHearings].filter(h => h).sort()[0] || '';
                         let nextH = targetEntry.nextHearing === targetDate ? soonest : targetEntry.nextHearing;

                         await updateDoc(doc(db, 'cases', targetId), { 
                             hearings: newHearings,
                             nextHearing: nextH
                         });
                     }
                     
                     // Calendar re-renders automatically via the listener in cases.js if onSnapshot is used,
                     // but we call it here just in case for immediate visual sync.
                     renderCalendar(); 
                     if(window.renderDashboard) window.renderDashboard(); 
                     showSuccess();
                 } catch(err) { 
                     console.error("Firebase Delete Error:", err);
                     alert("Error updating schedule. Please check your connection."); 
                     closeDel();
                 }
             };
          };

          promptAdminAction(showDeleteConfirm);
      };
  });
}

function openAddEventModal() {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="modal-overlay active">
        <div class="modal-content glow-panel" style="max-width: 450px;">
          <div class="modal-header">
            <h3>Add Custom Event</h3>
            <button class="close-btn" id="close-event-modal">&times;</button>
          </div>
          <div class="modal-body">
             <form id="event-form" class="form-grid">
                <div class="input-group full-width">
                  <label>Event Title</label>
                  <input type="text" id="ev-title" required placeholder="e.g. Court Holiday / Judicial Retreat" />
                </div>
                <div class="input-group">
                  <label>Date & Time</label>
                  <input type="datetime-local" id="ev-date" required />
                </div>
                <div class="input-group">
                  <label>Category</label>
                  <select id="ev-type">
                    <option value="Event">Custom Event</option>
                    <option value="Holiday">Holiday</option>
                    <option value="Meeting">Meeting</option>
                  </select>
                </div>
                <div class="input-group full-width">
                   <label>Notes</label>
                   <textarea id="ev-comments" rows="2"></textarea>
                </div>
                <div class="modal-footer full-width" style="text-align:right; margin-top:20px;">
                   <button type="button" class="btn-secondary" id="cancel-event">Cancel</button>
                   <button type="submit" class="btn-primary">Save Event</button>
                </div>
             </form>
          </div>
        </div>
      </div>
    `;

    document.getElementById('close-event-modal').onclick = () => modalContainer.innerHTML = '';
    document.getElementById('cancel-event').onclick = () => modalContainer.innerHTML = '';

    document.getElementById('event-form').onsubmit = async (e) => {
        e.preventDefault();
        const payload = {
            title: document.getElementById('ev-title').value,
            nextHearing: document.getElementById('ev-date').value,
            type: document.getElementById('ev-type').value,
            comments: document.getElementById('ev-comments').value,
            isEvent: true,
            status: 'Active',
            dateFiled: new Date().toISOString().split('T')[0]
        };
        try {
            await addDoc(collection(db, 'custom_events'), payload);
            modalContainer.innerHTML = '';
        } catch(err) { alert("Error saving event."); }
    };
  
  const printBtn = document.getElementById('print-schedule-btn');
  if(printBtn) {
      printBtn.onclick = () => printDailySchedule(dateStr, events);
  }
}

function printDailySchedule(dateStr, events) {
    const printWindow = window.open('', '_blank');
    const sortedEvents = [...events].sort((a,b) => new Date(a.nextHearing) - new Date(b.nextHearing));
    
    const bodyHtml = `
      <div style="font-family: Arial, sans-serif; padding: 40px; color: #000;">
         <div style="text-align: center; margin-bottom: 30px;">
            <h2 style="margin:0; text-transform: uppercase;">Republic of the Philippines</h2>
            <h3 style="margin:5px 0; text-transform: uppercase;">Regional Trial Court</h3>
            <p style="margin:0; font-style: italic;">Sipalay City, Negros Occidental</p>
            <hr style="margin-top: 20px; border: 1px solid #000;">
            <h1 style="margin: 20px 0; font-size: 1.5rem;">HEARING DOCKET</h1>
            <p style="font-weight: bold; font-size: 1.1rem;">Schedule for: ${dateStr}</p>
         </div>

         <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
               <tr style="background: #f0f0f0;">
                  <th style="border: 1px solid #000; padding: 10px; text-align: left;">TIME</th>
                  <th style="border: 1px solid #000; padding: 10px; text-align: left;">CASE NUMBER</th>
                  <th style="border: 1px solid #000; padding: 10px; text-align: left;">TITLE / PARTIES</th>
                  <th style="border: 1px solid #000; padding: 10px; text-align: left;">NATURE / VIOLATIONS</th>
                  <th style="border: 1px solid #000; padding: 10px; text-align: left;">TYPE</th>
               </tr>
            </thead>
            <tbody>
               ${sortedEvents.map(ev => `
                 <tr>
                    <td style="border: 1px solid #000; padding: 10px; font-weight: bold;">${new Date(ev.nextHearing).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                    <td style="border: 1px solid #000; padding: 10px;">${ev.isEvent ? 'N/A' : ev.caseNo}</td>
                    <td style="border: 1px solid #000; padding: 10px;">${ev.title}</td>
                    <td style="border: 1px solid #000; padding: 10px; font-size: 0.9rem;">${ev.nature || 'Custom Event'}</td>
                    <td style="border: 1px solid #000; padding: 10px;">${ev.type || 'Event'}</td>
                 </tr>
               `).join('')}
            </tbody>
         </table>
         
         <div style="margin-top: 50px; display:flex; justify-content:space-between;">
            <div style="width: 250px; border-top: 1px solid #000; text-align: center; padding-top: 5px;">
               <p style="margin:0; font-weight: bold;">PREPARED BY</p>
            </div>
            <div style="width: 250px; border-top: 1px solid #000; text-align: center; padding-top: 5px;">
               <p style="margin:0; font-weight: bold;">APPROVED BY</p>
            </div>
         </div>

         <p style="margin-top: 40px; font-size: 0.8rem; text-align: center; color: #555;">Generated by DocketPro Monitoring System v1.0</p>
      </div>
    `;

    printWindow.document.write('<html><head><title>Daily Hearing Docket - ' + dateStr + '</title></head><body>' + bodyHtml + '</body></html>');
    printWindow.document.close();
    
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}
