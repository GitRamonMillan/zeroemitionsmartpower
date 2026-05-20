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

        // ocultar botón si sidebar visible
        if (sidebar.classList.contains("open")) {
            ////menuBtn.style.display = "none"
            menuBtn.classList.add("hidden-btn")
            //closeSidebar.classList.remove("hidden-btn")
        }

    })

    const closeSidebar = document.getElementById("closeSidebar")

    closeSidebar.addEventListener("click", () => {
        //closeSidebar.classList.remove("hidden-btn")
        sidebar.classList.remove("open")

        // volver a mostrar hamburguesa
        // menuBtn.style.display = "block"
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

    // let atms = groups.flatMap(branch =>
    //   branch.atms.map(atm => {
    //     // buscar el ATM correspondiente en yesterdayData
    //     const yesterdayBranch = yesterday.find(b => b.name === branch.name)
    //     const yesterdayATM = yesterdayBranch?.atms.find(a => a.id === atm.id)
  
    //     console.log(atm);
        
    //     return {
    //       branch: branch.name,
    //       atmId: atm.id,
    //       action: "ON",
    //       confidence: 1,// Math.random() * 0.3 + (shouldOff ? 0.7 : 0.2),
    //       explanation: '',//generateLLMExplanation(atm),
    //       currentActivityState: atm.daily.at(-1)?.state,
    //       currentPowerState: atm.powerState
    //     }
    //   })
    // )

    // atms.forEach(atm => {
    //         console.log('data.forEach',atm);
    //     renderHourChart(atm);
    // })
  }

  function startEnergyListeners(){
    const playPauseBtn = document.getElementById('playPauseBtn');
    const resetBtn = document.getElementById('resetBtn');
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
        clearInterval(intervalId);
        seconds = 0;
        updateDisplay();
        const icon = playPauseBtn.querySelector('i');
        icon.classList.remove('bi-pause-fill');
        icon.classList.add('bi-play-fill');
        state.isRunning = false;
        console.log(state.isRunning);
      });


  }


  document.addEventListener("click", e => {
    console.log(e.target);
    if(e.target.id.indexOf('switchAtm') > -1 || e.target.id.indexOf('switchPower') > -1) return
    const target = e.target.closest(".atmShutdownPanel");
    console.log(target);
    if (!target) return;
    console.log("ATM clickeado:", target.dataset.atmbranch, target.dataset.atmid);
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
  console.log('detecta change switchPower')
  let switchPower = document.getElementById(e.target.id)
  console.log(switchPower)
  
  let switchPowerLabel = document.getElementById(e.target.id.replace('switchPower','switchPowerLabel'))
  console.log(switchPowerLabel)
  if (switchPower.checked) {
        switchPowerLabel.textContent = "Encendido";
    } else {
        switchPowerLabel.textContent = "Apagado"; 
    }
});


// const atmShutdownPanel = document.getElementById("atmShutdownPanel")
// atmShutdownPanel.addEventListener('click', e => {
//     console.log('atmshutdownoanel',e);


//     // const atmBranch = e.currentTarget.dataset.atmBranch;
//     // const atmId = e.currentTarget.dataset.atmId;
//     // console.log("ID clickeado:", atmBranch, atmId);
// });

//         // if (!selectedATM.length) return
    
//     //     const index = elements[0].index
//     //     selectedAtm = branch.atms[index]

//     //     renderHourChart(selectedAtm)},



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