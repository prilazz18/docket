document.addEventListener("DOMContentLoaded", () => {
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
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();

  const form = document.getElementById("loginForm");
  const toggle = document.querySelector(".toggle-password");
  const pass = document.getElementById("password");
  const loginBtn = document.getElementById("loginBtn");
  const progressContainer = document.getElementById("loginProgressContainer");
  const progressBar = document.getElementById("loginProgressBar");

  if (toggle && pass) toggle.onclick = () => pass.type = pass.type === "password" ? "text" : "password";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = pass.value;

    progressContainer.style.display = "block";
    progressBar.style.width = "0%";
    let progress = 0;
    const interval = setInterval(() => {
      if (progress >= 100) clearInterval(interval);
      progress += 2;
      progressBar.style.width = progress + "%";
    }, 20);

    try {
      await auth.signInWithEmailAndPassword(email, password);
      clearInterval(interval);
      progressBar.style.width = "100%";
      setTimeout(() => { window.location.href = "dashboard.html"; }, 300);
    } catch (err) {
      clearInterval(interval);
      progressBar.style.width = "0%";
      progressContainer.style.display = "none";
      alert("Login failed: " + err.message);
    }
  });
});