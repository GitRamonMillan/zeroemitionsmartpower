import { renderHome } from '../views/home.js'
import { renderUsers } from '../views/users.js'
import { renderSettings } from '../views/settings.js'

export function renderDashboard(onLogout) {
    document.querySelector('#app').innerHTML = `
    <div class="d-flex vh-100">
  
      <!-- SIDEBAR -->
      <div class="bg-dark text-white p-3 d-flex flex-column shadow-lg"
           style="width: 240px; min-height: 100vh;">
        
        <h4 class="mb-4">Panel</h4>
  
        <button class="btn btn-secondary mb-2" id="navHome">Inicio</button>
        <button class="btn btn-secondary mb-2" id="navUsers">Usuarios</button>
        <button class="btn btn-secondary mb-2" id="navSettings">Ajustes</button>
  
        <hr class="text-white">
  
        <button class="btn btn-danger mt-auto" id="logoutBtn">
          Salir
        </button>
      </div>
  
      <!-- CONTENT -->
      <div class="flex-grow-1 p-4" id="content"></div>
  
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

  // navegación
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