import { api } from '../api/api.js'

// export function getEnergy() {
//   return api.getEnergy()
// }

export function updateEnergy(values) {
  return api.updateEnergy(values)
}

export function getEnergy() {
    const groups = ["Sucursal A", "Sucursal B", "Sucursal C"]
  
    return groups.map(group => ({
      name: group,
      atms: Array.from({ length: 10 }, (_, i) => ({
        id: `ATM-${i + 1}`,
        consumption: Math.floor(Math.random() * 50) + 20
      }))
    }))
  }