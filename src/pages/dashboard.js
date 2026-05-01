import { renderHome } from '../views/home.js'
import { renderUsers } from '../views/users.js'
import { renderSettings } from '../views/settings.js'
import { renderEnergy } from '../views/energy.js'

export function renderDashboard(onLogout) {
    document.querySelector('#app').innerHTML = `
    <div class="d-flex" style="height: 100vh; overflow: hidden;">
  
      <!-- SIDEBAR -->
      <div class="bg-dark text-white p-3 d-flex flex-column"
     style="width: 240px; height: 100vh;">
        
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

  const content = document.querySelector('#content')

  function showHome() {
    content.innerHTML = renderHome()
  }

  function showUsers() {
    content.innerHTML = renderUsers()
  }

  function showSettings() {
    content.innerHTML = renderSettings()
  }

  function showEnergy() {
    content.innerHTML = renderEnergy()
    // renderEnergy().then(html => {
    //   content.innerHTML = html
    // })
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