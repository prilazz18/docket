document.addEventListener("DOMContentLoaded", () => {

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
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

  const auth = firebase.auth();
  const db = firebase.database();

  // ================= ELEMENTS =================
  const addCaseBtn = document.getElementById("addCaseBtn");
  const caseModal = document.getElementById("caseModal");
  const closeBtn = caseModal.querySelector(".close");
  const saveCaseBtn = document.getElementById("saveCaseBtn");
  const tableBody = document.querySelector("table tbody");

  const fields = {
    caseType: document.getElementById("caseType"),
    caseDateFiled: document.getElementById("caseDateFiled"),
    caseNo: document.getElementById("caseNo"),
    caseTitle: document.getElementById("caseTitle"),
    complainant: document.getElementById("complainant"),
    accused: document.getElementById("accused"),
    counselAccused: document.getElementById("counselAccused"),
    counselComplainant: document.getElementById("counselComplainant"),
    violations: document.getElementById("violations"),
    status: document.getElementById("status"),
    lastAction: document.getElementById("lastAction"),
    hearingDate: document.getElementById("hearingDate")
  };

  let editId = null; // track edit

  // ================= OPEN MODAL =================
  addCaseBtn.addEventListener("click", () => {
    caseModal.style.display = "block";
    saveCaseBtn.textContent = "Add Case";
    editId = null;
    Object.values(fields).forEach(f => f.value = "");
  });

  closeBtn.addEventListener("click", () => caseModal.style.display = "none");
  window.addEventListener("click", e => { if(e.target === caseModal) caseModal.style.display = "none"; });

  // ================= LOGOUT =================
  document.getElementById("logoutBtn").onclick = () => auth.signOut().then(() => location.href="index.html");

  // ================= SAVE CASE =================
  saveCaseBtn.addEventListener("click", async () => {
    const caseData = {};
    Object.keys(fields).forEach(key => caseData[key] = fields[key].value);

    try {
      if(editId){
        await db.ref("cases/" + editId).update(caseData);
        alert("Case updated!");
      } else {
        const newRef = db.ref("cases").push();
        await newRef.set(caseData);
        alert("Case added!");
      }
      caseModal.style.display = "none";
      loadCases();
    } catch(err){
      alert("Error saving case: " + err.message);
    }
  });

  // ================= LOAD CASES =================
  function loadCases(){
    db.ref("cases").once("value", snapshot => {
      tableBody.innerHTML = `
        <tr>
          <th>ID</th>
          <th>Case Title</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      `;
      snapshot.forEach(child => {
        const data = child.val();
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${child.key}</td>
          <td>${data.caseTitle}</td>
          <td class="status-${data.status.toLowerCase()}">${data.status}</td>
          <td>
            <button class="edit-btn" data-id="${child.key}">Edit</button>
            <button class="delete-btn" data-id="${child.key}">Delete</button>
          </td>
        `;
        tableBody.appendChild(tr);
      });

      // ================= EDIT CASE =================
      tableBody.querySelectorAll(".edit-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          editId = btn.dataset.id;
          const snapshot = await db.ref("cases/" + editId).once("value");
          const data = snapshot.val();
          Object.keys(fields).forEach(key => fields[key].value = data[key] || "");
          caseModal.style.display = "block";
          saveCaseBtn.textContent = "Update Case";
        });
      });

      // ================= DELETE CASE =================
      tableBody.querySelectorAll(".delete-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const user = auth.currentUser;
          if(!user) return alert("Must be logged in to delete!");
          if(confirm("Are you sure you want to delete this case?")){
            db.ref("cases/" + btn.dataset.id).remove();
            loadCases();
          }
        });
      });

    });
  }

  // ================= SEARCH =================
  document.getElementById("searchCase").addEventListener("input", e => {
    const filter = e.target.value.toLowerCase();
    tableBody.querySelectorAll("tr").forEach(row => {
      if(row.querySelector("td")){
        const title = row.querySelector("td:nth-child(2)").textContent.toLowerCase();
        const status = row.querySelector("td:nth-child(3)").textContent.toLowerCase();
        row.style.display = title.includes(filter) || status.includes(filter) ? "" : "none";
      }
    });
  });

  // ================= INITIAL LOAD =================
  loadCases();

});