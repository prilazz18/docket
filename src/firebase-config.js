import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

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

let app, db, auth;

try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
} catch (error) {
    console.error("Firebase Error:", error);
}

export { db, auth };
