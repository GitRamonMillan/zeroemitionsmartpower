export function initLogin(onSuccess) {
  document.querySelector('#loginForm').addEventListener('submit', (e) => {
    e.preventDefault()

    const user = document.querySelector('#username').value
    const pass = document.querySelector('#password').value

    if (user === 'admin' && pass === '1234') {
      localStorage.setItem('auth', 'true')
      onSuccess()
    } else {
      document.querySelector('#error').classList.remove('d-none')
    }
  })
}