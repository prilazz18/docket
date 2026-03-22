import './firebase-config.js';
import { setupAuth } from './auth.js';
import { renderDashboard } from './dashboard.js';
import { setupCases } from './cases.js';
import { renderCalendar, initCalendar } from './calendar.js';
import { setupExport } from './export.js';

const initApp = () => {
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const targetId = item.getAttribute('data-target');
            if(!targetId) return;
            
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Dynamic Title sync
            const titleEl = document.getElementById('current-tab-title');
            if (titleEl) {
                const label = item.textContent.trim().replace(/[📊📂📅🚀]/g, '').trim();
                titleEl.innerText = label;
            }

            // FAB visibility (Show only on cases-tab)
            const addCaseBtn = document.getElementById('add-case-btn');
            if (addCaseBtn) {
                if (targetId === 'cases-tab') {
                    addCaseBtn.classList.remove('hidden');
                } else {
                    addCaseBtn.classList.add('hidden');
                }
            }
            
            tabPanes.forEach(pane => {
                pane.classList.add('hidden');
                pane.classList.remove('active');
            });
            
            const targetPane = document.getElementById(targetId);
            if(targetPane) {
                targetPane.classList.remove('hidden');
                setTimeout(() => targetPane.classList.add('active'), 10);
            }
            
            if(targetId === 'overview-tab') renderDashboard();
            if(targetId === 'calendar-tab') renderCalendar();
        });
    });

    setupAuth();
    setupCases();
    setupExport();
    initCalendar();

    const clockEl = document.getElementById('live-clock');
    if (clockEl) {
        const updateClock = () => {
            const now = new Date();
            clockEl.innerText = now.toLocaleTimeString('en-US', {
                timeZone: 'Asia/Manila',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
        };
        updateClock();
        setInterval(updateClock, 1000);
    }

    const themeToggleBtn = document.getElementById('theme-toggle');
    if(themeToggleBtn) {
        const savedTheme = localStorage.getItem('docketpro-theme') || 'dark';
        if(savedTheme === 'light') {
            document.body.classList.add('light-mode');
            themeToggleBtn.innerHTML = '<span class="icon" style="margin:0;">🌙</span>';
        }
        
        themeToggleBtn.addEventListener('click', () => {
            const isLight = document.body.classList.toggle('light-mode');
            localStorage.setItem('docketpro-theme', isLight ? 'light' : 'dark');
            themeToggleBtn.innerHTML = isLight ? '<span class="icon" style="margin:0;">🌙</span>' : '<span class="icon" style="margin:0;">☀️</span>';
        });
    }

    const sidebar = document.querySelector('.sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    if(sidebar && toggleBtn) {
        toggleBtn.onclick = () => {
            sidebar.classList.toggle('collapsed');
        };
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
