import { renderHome } from '../views/home.js'
import { renderUsers } from '../views/users.js'
import { renderSettings } from '../views/settings.js'
import { renderEnergy } from '../views/energy.js'
import { state } from '../state/state.js'
import { yesterday, groups, renderHourChart, renderYesterdayHourChart } from '../views/energy.js';

export function renderDashboard(onLogout) {
    document.querySelector('#app').innerHTML = `
    <button id="menuBtn" class="menu-btn">
  ☰
</button>
    <div class="d-flex" style="height: 100vh; overflow: hidden;">
        
      <!-- SIDEBAR -->
      <div id="sidebar" class="bg-dark text-white p-3 d-flex flex-column sidebar" style="width: 240px; height: 100vh;">
      <button id="closeSidebar" class="btn btn-light btn-sm mb-3">
      ✕
      </button>
        <h4 class="mb-4">Panel</h4>
        <button class="btn btn-secondary mb-2" id="navEnergy">Energía</button>
        <button class="btn btn-secondary mb-2" id="navHome">Inicio</button>
        <button class="btn btn-secondary mb-2" id="navUsers">Usuarios</button>
        <button class="btn btn-secondary mb-2" id="navSettings">Ajustes</button>
  
        <hr class="text-white">
  
        <button class="btn btn-danger mt-auto" id="logoutBtn">
          Salir
        </button>
      </div>
  
      <!-- CONTENT -->
      <div class="flex-grow-1 p-4"
            id="content"
            style="overflow-y: auto;">
        </div>
  
    </div>
  `



  const menuBtn = document.getElementById("menuBtn")
    const sidebar = document.getElementById("sidebar")

    menuBtn.addEventListener("click", () => {

        sidebar.classList.toggle("open")

        if (sidebar.classList.contains("open")) {
            menuBtn.classList.add("hidden-btn")
        }

    })

    const closeSidebar = document.getElementById("closeSidebar")

    closeSidebar.addEventListener("click", () => {
        sidebar.classList.remove("open")
        menuBtn.classList.remove("hidden-btn")
    })

  const content = document.querySelector('#content')
  

  function showHome() {
    document.getElementById("closeSidebar")?.click()
    content.innerHTML = renderHome()
  }

  function showUsers() {
    document.getElementById("closeSidebar")?.click()
    content.innerHTML = renderUsers()
  }

  function showSettings() {
    document.getElementById("closeSidebar")?.click()
    content.innerHTML = renderSettings()
  }

  function showEnergy() {
    document.getElementById("closeSidebar")?.click()
    content.innerHTML = renderEnergy()

    startEnergyListeners()
  }

  function startEnergyListeners(){
    const playPauseBtn = document.getElementById('playPauseBtn');
    const resetBtn = document.getElementById('resetBtn');
    const LLMBtn = document.getElementById('LLMBtn');
        // Listener del botón
      playPauseBtn.addEventListener('click', () => {
        const icon = playPauseBtn.querySelector('i');
        if (!state.isRunning) {
            icon.classList.remove('bi-play-fill');
            icon.classList.add('bi-pause-fill');
            state.isRunning = true;
        } else {
            icon.classList.remove('bi-pause-fill');
            icon.classList.add('bi-play-fill');
            state.isRunning = false;
        }
        console.log(state.isRunning);
      });

      // Listener del reset
      resetBtn.addEventListener('click', () => {
        self.location.reload();
        // clearInterval(intervalId);
        // seconds = 0;
        // updateDisplay();
        // const icon = playPauseBtn.querySelector('i');
        // icon.classList.remove('bi-pause-fill');
        // icon.classList.add('bi-play-fill');
        // state.isRunning = false;
      });

      LLMBtn.addEventListener('click', () => {
        state.useLLMAPI = !state.useLLMAPI;
        if (!state.useLLMAPI) {
          LLMBtn.classList.remove('btn-primary');
          LLMBtn.classList.add('btn-secondary');
        } else {
          LLMBtn.classList.remove('btn-secondary');
          LLMBtn.classList.add('btn-primary');
        }
        // clearInterval(intervalId);
        // seconds = 0;
        // updateDisplay();
        // const icon = playPauseBtn.querySelector('i');
        // icon.classList.remove('bi-pause-fill');
        // icon.classList.add('bi-play-fill');
        // state.isRunning = false;
      });
  }


  document.addEventListener("click", e => {
    if(e.target.id.indexOf('switchAtm') > -1 || e.target.id.indexOf('switchPower') > -1) return
    const target = e.target.closest(".atmShutdownPanel");
    if (!target) return;
    // Busca el ATM dentro de groups
    const branch = groups.find(b => b.name === target.dataset.atmbranch);
    const atm = branch?.atms.find(a => a.id === target.dataset.atmid);

    const yesterdayBranch = yesterday.find(b => b.name === target.dataset.atmbranch);
    const yesterdayAtm = yesterdayBranch?.atms.find(a => a.id === target.dataset.atmid);

    renderYesterdayHourChart({
        ...yesterdayAtm,
        branch: target.dataset.atmbranch
    });

    renderHourChart({
      ...atm,
      branch: target.dataset.atmbranch
    });
    const chartsDiv = document.getElementById(`atmActivityCharts-${target.dataset.atmbranch}-${target.dataset.atmid}`);
    chartsDiv.classList.toggle("hidden-div");
});

document.addEventListener("change", e => {
  if(e.target.id.indexOf('switchPower') == -1) return
  let switchPower = document.getElementById(e.target.id)
  
  let switchPowerLabel = document.getElementById(e.target.id.replace('switchPower','switchPowerLabel'))
  if (switchPower.checked) {
        switchPowerLabel.textContent = "Encendido";
    } else {
        switchPowerLabel.textContent = "Apagado"; 
    }
});

  // navegación
  document.querySelector('#navEnergy').onclick = showEnergy
  document.querySelector('#navHome').onclick = showHome
  document.querySelector('#navUsers').onclick = showUsers
  document.querySelector('#navSettings').onclick = showSettings

  // logout
  document.querySelector('#logoutBtn').onclick = () => {
    localStorage.removeItem('auth')
    onLogout()
  }

  // vista inicial
  showHome()
}