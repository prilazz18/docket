const firebaseConfig = {
  apiKey: "AIzaSyBGfWPzPvYdjqdAZmNw4jbh5RyYxt-2YrU",
  authDomain: "docket-monitoring.firebaseapp.com",
  databaseURL: "https://docket-monitoring-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "docket-monitoring",
  storageBucket: "docket-monitoring.firebasestorage.app",
  messagingSenderId: "874433490554",
  appId: "1:874433490554:web:4cb072a337e2aa5bd5d5c3"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();