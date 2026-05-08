import { getDB, saveDB } from './db.js'

// simula delay de backend
const delay = (ms) => new Promise(r => setTimeout(r, ms))

export const api = {
  async login(username, password) {
    await delay(300)

    const db = getDB()

    if (
      username === db.user.username &&
      password === db.user.password
    ) {
      return { token: "fake-jwt-token" }
    }

    throw new Error("Credenciales inválidas")
  },

  async getEnergy() {
    await delay(200)
    return getDB().energy
  },
  
  async getYesterdayData() {
    await delay(200)
    return getDB().energy
  },

  async updateEnergy(newValues) {
    await delay(200)
    const db = getDB()
    db.energy = newValues
    saveDB(db)
    return true
  },

  async getUsers() {
    await delay(200)
    return getDB().users
  },

  async updateUsers(users) {
    await delay(200)
    const db = getDB()
    db.users = users
    saveDB(db)
    return true
  }
}