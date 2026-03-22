// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBGfWPzPvYdjqdAZmNw4jbh5RyYxt-2YrU",
  authDomain: "docket-monitoring.firebaseapp.com",
  databaseURL: "https://docket-monitoring-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "docket-monitoring",
  storageBucket: "docket-monitoring.firebasestorage.app",
  messagingSenderId: "874433490554",
  appId: "1:874433490554:web:4cb072a337e2aa5bd5d5c3",
  measurementId: "G-DKEVYVEWSF"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// ================== LOGOUT ==================
const logoutBtn = document.getElementById("logoutBtn");
logoutBtn.addEventListener("click", () => {
  auth.signOut().then(() => {
    window.location.href = "index.html";
  });
});

// ================== SIDEBAR NAVIGATION ==================
const menuOverview = document.getElementById("menu-overview");
// const menuCalendar = document.getElementById("menu-calendar"); // removed calendar
const mainContent = document.getElementById("main-content");

// Active button highlight
document.querySelectorAll(".menu-buttons button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".menu-buttons button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// ================== OVERVIEW ==================
function loadOverview() {
  mainContent.innerHTML = `
    <h1>Dashboard Overview</h1>
    <div class="cards-container">
      <div class="card">
        <h3>Total Cases</h3>
        <p id="totalCases">0</p>
      </div>
      <div class="card">
        <h3>Active Cases</h3>
        <p id="activeCases">0</p>
      </div>
      <div class="card">
        <h3>Disposed Cases</h3>
        <p id="disposedCases">0</p>
      </div>
    </div>
  `;

  // Fetch and display case statistics
  database.ref("cases").once("value", snapshot => {
    const casesData = snapshot.val() || {};
    const allCases = Object.values(casesData);
    const total = allCases.length;
    const active = allCases.filter(c => c.status.toLowerCase() === "active").length;
    const disposed = allCases.filter(c => c.status.toLowerCase() === "disposed").length;

    document.getElementById("totalCases").textContent = total;
    document.getElementById("activeCases").textContent = active;
    document.getElementById("disposedCases").textContent = disposed;
  });
}

// ================== INITIAL LOAD ==================
loadOverview();

// ================== CASES BUTTON ==================
// Cases button uses <button onclick="location.href='cases.html'"> in HTML
// So no JS needed here
