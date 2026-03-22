import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

export function setupAuth() {
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');
    const loadingContainer = document.getElementById('login-loading');
    const loadingFill = document.getElementById('loading-fill');
    const loadingPct = document.getElementById('loading-pct');
    const togglePwdBtn = document.getElementById('toggle-password');
    const pwdInput = document.getElementById('password');

    if (togglePwdBtn && pwdInput) {
        togglePwdBtn.onclick = () => {
            const isPwd = pwdInput.type === 'password';
            pwdInput.type = isPwd ? 'text' : 'password';
            togglePwdBtn.style.color = isPwd ? 'var(--accent-primary)' : 'var(--text-muted)';
        };
    }

    onAuthStateChanged(auth, (user) => {
        if (user && !window.isLoggingIn) { // Only auto-switch if not in custom login flow
            loginView.classList.add('hidden');
            dashboardView.classList.remove('hidden');
            const disp = document.getElementById('display-name');
            const avatar = document.getElementById('user-avatar');
            if (disp) disp.innerText = user.email.split('@')[0].toUpperCase();
            if (avatar) avatar.innerText = user.email.substring(0, 2).toUpperCase();
        } else if (!user) {
            loginView.classList.remove('hidden');
            dashboardView.classList.add('hidden');
        }
    });

    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = pwdInput.value;

            loginForm.classList.add('hidden');
            loadingContainer.classList.remove('hidden');
            window.isLoggingIn = true; // Prevent premature switch
            
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 10;
                if (progress > 90) progress = 90; // Hold at 90 till firebase responds
                loadingFill.style.width = `${progress}%`;
                loadingPct.innerText = `${Math.floor(progress)}%`;
            }, 100);

            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Sync user data for later switch
                const disp = document.getElementById('display-name');
                const avatar = document.getElementById('user-avatar');
                if (disp) disp.innerText = user.email.split('@')[0].toUpperCase();
                if (avatar) avatar.innerText = user.email.substring(0, 2).toUpperCase();

                // Forcefully clear the interval
                clearInterval(interval);
                loadingFill.style.width = '100%';
                loadingPct.innerText = '100%';

                const finalizeLogin = () => {
                    console.log("Finalizing login and transitioning to dashboard.");
                    const modalContainer = document.getElementById('modal-container');
                    if (modalContainer) modalContainer.innerHTML = '';
                    
                    window.isLoggingIn = false;
                    
                    // Direct manipulation for guaranteed transition
                    const lv = document.getElementById('login-view');
                    const dv = document.getElementById('dashboard-view');
                    const lc = document.getElementById('login-loading');
                    const lf = document.getElementById('login-form');
                    
                    if (lc) lc.classList.add('hidden');
                    if (lf) lf.classList.remove('hidden');
                    if (lv) lv.classList.add('hidden');
                    if (dv) dv.classList.remove('hidden');
                    console.log("Login finalized. Dashboard should be visible.");
                };

                // Show "Access Granted" popup
                const modalContainer = document.getElementById('modal-container');
                modalContainer.innerHTML = `
                    <div class="modal-overlay active">
                      <div class="modal-content glow-panel" style="max-width: 400px; text-align: center; border-color: var(--accent-primary);">
                        <div class="modal-body" style="padding: 40px;">
                           <div style="font-size: 4rem; margin-bottom: 20px;">🛡️</div>
                           <h2 style="color: var(--accent-primary); margin-bottom: 10px; font-family: 'Outfit'; letter-spacing: 2px;">ACCESS GRANTED</h2>
                           <p style="color: var(--text-muted); font-size: 0.9rem;">Identity Verified. Redirecting to Secure Dashboard...</p>
                           <button id="manual-enter-btn" class="btn-primary" style="margin-top: 20px; font-size: 0.75rem; padding: 8px 15px; opacity: 0.5;">Enter Now</button>
                        </div>
                      </div>
                    </div>
                `;

                // Add manual backup button just in case
                const btn = document.getElementById('manual-enter-btn');
                if (btn) btn.onclick = finalizeLogin;

                // Automatic redirect after 1.5 seconds
                setTimeout(finalizeLogin, 1500);

            } catch (error) {
                // Safeguard against any hanging interval
                clearInterval(interval);
                window.isLoggingIn = false;

                const lc = document.getElementById('login-loading');
                const lf = document.getElementById('login-form');
                const fill = document.getElementById('loading-fill');
                const pct = document.getElementById('loading-pct');

                if (lc) lc.classList.add('hidden');
                if (lf) lf.classList.remove('hidden');
                if (fill) fill.style.width = '0%';
                if (pct) pct.innerText = '0%';

                const modalContainer = document.getElementById('modal-container');
                let userMsg = "Invalid Credentials. Please check your email and Secure Key and try again.";
                if (error.code === 'auth/user-not-found') userMsg = "The email address is not registered in the system.";
                if (error.code === 'auth/too-many-requests') userMsg = "Account temporarily locked due to multiple failed attempts. Please try again later.";
                
                modalContainer.innerHTML = `
                  <div class="modal-overlay active">
                    <div class="modal-content glow-panel" style="max-width: 400px; border-color: #ef4444;">
                      <div class="modal-header" style="background: rgba(239, 68, 68, 0.1); border-bottom: 2px solid #ef4444;">
                        <h3 style="color: #ef4444; display: flex; align-items: center; gap: 8px; margin: 0; font-family: 'Outfit'; font-weight: 700;">
                           <span style="font-size: 1.25rem;">🛑</span> SECURITY ALERT
                        </h3>
                        <button class="close-btn" id="close-error-modal" style="color: #ef4444;">&times;</button>
                      </div>
                      <div class="modal-body text-center" style="padding: 30px;">
                         <p style="font-weight: 800; color: #fff; margin-bottom: 10px; font-size: 1.2rem; letter-spacing: 2px;">ACCESS DENIED</p>
                         <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 20px; line-height: 1.5;">${userMsg}</p>
                         <div style="background: rgba(0,0,0,0.5); padding: 12px; border-radius: 6px; border: 1px dashed #ef4444; margin-bottom: 25px;">
                            <code style="color: #ef4444; font-size: 0.75rem;">SYS_ERR: ${error.code || 'authentication_failure'}</code>
                         </div>
                         <button id="error-ack-btn" class="btn-primary" style="width: 100%; background: #ef4444; color: #000; font-weight: 800; border: none;">ACKNOWLEDGE</button>
                      </div>
                    </div>
                  </div>
                `;
                document.getElementById('close-error-modal').onclick = () => modalContainer.innerHTML = '';
                document.getElementById('error-ack-btn').onclick = () => modalContainer.innerHTML = '';
            }
        };
    }

    if (logoutBtn) {
        logoutBtn.onclick = () => {
            const modalContainer = document.getElementById('modal-container');
            modalContainer.innerHTML = `
              <div class="modal-overlay active">
                <div class="modal-content glow-panel" style="max-width: 400px; text-align: center; border-color: var(--accent-secondary);">
                  <div class="modal-header">
                    <h3 style="color: var(--accent-secondary);">Terminate Session</h3>
                    <button class="close-btn" id="close-logout-modal">&times;</button>
                  </div>
                  <div class="modal-body" style="padding: 30px;">
                     <div style="font-size: 3rem; margin-bottom: 20px;">🛡️</div>
                     <p style="margin-bottom: 25px; color: var(--text-main); font-weight: 500;">Are you sure you want to securely end your administrative session?</p>
                     <div style="display: flex; gap: 15px; justify-content: center;">
                        <button id="cancel-logout" class="btn-secondary" style="flex: 1;">Keep Active</button>
                        <button id="confirm-logout" class="btn-primary" style="flex: 1; background: var(--accent-secondary); color: #fff;">Log Out</button>
                     </div>
                  </div>
                </div>
              </div>
            `;
            
            const close = () => modalContainer.innerHTML = '';
            document.getElementById('close-logout-modal').onclick = close;
            document.getElementById('cancel-logout').onclick = close;
            document.getElementById('confirm-logout').onclick = () => {
                signOut(auth).catch(err => console.error(err));
                close();
            };
        };
    }
}
