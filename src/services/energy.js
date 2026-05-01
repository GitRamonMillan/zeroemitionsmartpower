import { api } from '../api/api.js'

export function getEnergy() {
  return api.getEnergy()
}

export function updateEnergy(values) {
  return api.updateEnergy(values)
}