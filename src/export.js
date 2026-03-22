import { getFilteredCases } from './cases.js';
import { promptAdminAction } from './cases.js';

export function setupExport() {
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      promptAdminAction(() => {
        const data = getFilteredCases();
        if (data.length === 0) {
          alert("No data available to export based on current filters.");
          return;
        }
        downloadCSV(data);
      }, "⚠️ SECURITY PROTOCOL: Administrative password required to export local data to CSV.");
    });
  }
}

function downloadCSV(data) {
  const headers = ['Case No.', 'Title', 'Place', 'Type', 'Status', 'Date Filed', 'Next Hearing', 'Nature/Violations', 'Complainant', 'Respondent', 'Comments'];
  
  const rows = data.map(c => [
    `"${(c.caseNo || '').replace(/"/g, '""')}"`,
    `"${(c.title || '').replace(/"/g, '""')}"`,
    `"${(c.place || '').replace(/"/g, '""')}"`,
    `"${(c.type || '').replace(/"/g, '""')}"`,
    `"${(c.status || '').replace(/"/g, '""')}"`,
    `"${(c.dateFiled || '').replace(/"/g, '""')}"`,
    `"${(c.nextHearing || '').replace(/"/g, '""')}"`,
    `"${(c.nature || '').replace(/"/g, '""')}"`,
    `"${(c.complainant || '').replace(/"/g, '""')}"`,
    `"${(c.respondent || '').replace(/"/g, '""')}"`,
    `"${(c.comments || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  const timestamp = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `RTC_Docket_Export_${timestamp}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
