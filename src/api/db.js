const DEFAULT_DB = {
    user: { username: "admin", password: "1234" },
    energy: [30, 45, 28, 60, 50],
    users: [
      { id: 1, name: "Admin", active: true },
      { id: 2, name: "User 2", active: false }
    ]
  }
  
  export function initDB() {
    if (!localStorage.getItem("db")) {
      localStorage.setItem("db", JSON.stringify(DEFAULT_DB))
    }
  }

  export function getDB() {
    const db = localStorage.getItem("db")
  
    if (!db) {
      localStorage.setItem("db", JSON.stringify(DEFAULT_DB))
      return DEFAULT_DB
    }
  
    return JSON.parse(db)
  }
  
  export function saveDB(db) {
    localStorage.setItem("db", JSON.stringify(db))
  }