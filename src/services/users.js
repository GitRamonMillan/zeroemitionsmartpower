import { api } from '../api/api.js'

export function getUsers() {
  return api.getUsers()
}

export function updateUsers(users) {
  return api.updateUsers(users)
}