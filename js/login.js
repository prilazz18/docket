// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBGfWPzPvYdjqdAZmNw4jbh5RyYxt-2YrU",
  authDomain: "docket-monitoring.firebaseapp.com",
  databaseURL: "https://docket-monitoring-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "docket-monitoring",
  storageBucket: "docket-monitoring.firebasestorage.app",
  messagingSenderId: "874433490554",
  appId: "1:874433490554:web:c163778ee9863bbcd5d5c3",
  measurementId: "G-E34HW0XWJ6"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Elements
const loginForm = document.getElementById("loginForm");
const toggle = document.querySelector(".toggle-password");
const pass = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const loginProgressContainer = document.getElementById("loginProgressContainer");
const loginProgressBar = document.getElementById("loginProgressBar");

// Toggle password visibility
if (toggle && pass) toggle.onclick = () => pass.type = pass.type === "password" ? "text" : "password";

// Handle Login Submit
if (loginForm) {
  loginForm.addEventListener("submit", e => {
    e.preventDefault();

    // Disable button and show progress bar
    loginBtn.disabled = true;
    loginProgressContainer.style.display = "block";
    loginProgressBar.style.width = "0%";

    let progress = 0;
    const interval = setInterval(() => {
      if (progress >= 100) clearInterval(interval);
      progress += 1;
      loginProgressBar.style.width = progress + "%";
    }, 15);

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    auth.signInWithEmailAndPassword(email, password)
      .then(() => {
        // Redirect only after login
        window.location.href = "dashboard.html";
      })
      .catch(err => {
        alert("Login failed: " + err.message);
        loginBtn.disabled = false;
        loginProgressContainer.style.display = "none";
        loginProgressBar.style.width = "0%";
      });
  });
}

// TEMPORARILY REMOVE AUTO REDIRECT
/*
auth.onAuthStateChanged(user => {
  if (user && window.location.pathname.endsWith("index.html")) {
    window.location.href = "dashboard.html";
  }
});
*/