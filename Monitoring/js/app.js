document.addEventListener("DOMContentLoaded", () => {

  const main = document.getElementById("main-content");

  function load(view){
    if(view === "Overview"){
      main.innerHTML = `
        <h1>Overview</h1>
        <div class="cards-container">
          <div class="card"><p>12</p><small>Cases Today</small></div>
          <div class="card"><p>24</p><small>Pending</small></div>
          <div class="card"><p>8</p><small>Resolved</small></div>
        </div>
      `;
    } else {
      main.innerHTML = `<h1>${view}</h1>`;
    }
  }

  load("Overview");

  document.getElementById("menu-overview").onclick = () => load("Overview");
  document.getElementById("menu-calendar").onclick = () => load("Calendar");

});