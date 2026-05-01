import { api } from '../api/api.js'

export async function login(username, password) {
  const res = await api.login(username, password)
  localStorage.setItem('auth', res.token)
  return res
}

export function logout() {
  localStorage.removeItem('auth')
}

export function isAuth() {
  return !!localStorage.getItem('auth')
}