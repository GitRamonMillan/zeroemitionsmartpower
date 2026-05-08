import { renderHome } from '../views/home.js'
import { renderUsers } from '../views/users.js'
import { renderSettings } from '../views/settings.js'
import { renderEnergy } from '../views/energy.js'

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
  }

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