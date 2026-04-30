import { setupCounter } from './counter.js'
import { initLogin } from './pages/login.js'
import { renderDashboard } from './pages/dashboard.js'

function showLogin() {
  document.querySelector('#app').innerHTML = `
    <div class="container d-flex justify-content-center align-items-center vh-100">
      <div class="card p-4 shadow" style="width: 350px;">
        <h3 class="text-center mb-3">Login</h3>

        <form id="loginForm">
          <input id="username" class="form-control mb-2" placeholder="Usuario" />
          <input id="password" type="password" class="form-control mb-2" placeholder="Contraseña" />

          <button class="btn btn-primary w-100">Ingresar</button>
        </form>

        <div id="error" class="text-danger text-center mt-3 d-none">
          Credenciales incorrectas
        </div>
      </div>
    </div>
  `

  initLogin(showDashboard)
}

function showDashboard() {
  renderDashboard(showLogin)
}

if (localStorage.getItem('auth') === 'true') {
  showDashboard()
} else {
  showLogin()
}