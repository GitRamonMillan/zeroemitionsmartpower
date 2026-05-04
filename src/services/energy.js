import { api } from '../api/api.js'

export function updateEnergy(values) {
  return api.updateEnergy(values)
}

// export function getEnergy() {
//     const groups = ["Agustinas", "Huérfanos", "Moneda"]
  
//     return groups.map(group => ({
//       name: group,
//       atms: Array.from({ length: 10 }, (_, i) => ({
//         id: `ATM-${i + 1}`,
//         consumption: Math.floor(Math.random() * 50) + 20
//       }))
//     }))
//   }

export function getEnergy() {
    const groups = ["Agustinas", "Huérfanos", "Moneda"]
  
    function generateSchedule() {
      const start = Math.floor(Math.random() * 4) + 7 // 7–10
      const duration = Math.floor(Math.random() * 6) + 10 // 10–16 horas operativas
  
      const operationHours = Array.from({ length: duration }, (_, i) => (start + i) % 24)
      const idleHours = Array.from({ length: 24 }, (_, h) => h)
        .filter(h => !operationHours.includes(h))
  
      return { operationHours, idleHours }
    }
  
    function generateDaily(schedule) {
      return Array.from({ length: 24 }, (_, h) => {
        const isOperating = schedule.operationHours.includes(h)
  
        return {
          hour: `${h}:00`,
          state: isOperating ? "operational" : "idle",
          kwh: isOperating
            ? Math.floor(Math.random() * 4) + 3   // 3–6 kWh
            : Math.floor(Math.random() * 2) + 1   // 1–2 kWh
        }
      })
    }
  
    function generateWeekly() {
      const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
      return days.map(d => ({
        day: d,
        kwh: Math.floor(Math.random() * 40) + 20
      }))
    }
  
    function generateMonthly() {
      return Array.from({ length: 30 }, (_, d) => ({
        day: d + 1,
        kwh: Math.floor(Math.random() * 50) + 20
      }))
    }
  
    return groups.map(group => ({
      name: group,
      atms: Array.from({ length: 10 }, (_, i) => {
        const schedule = generateSchedule()
        const daily = generateDaily(schedule)
        const total = daily.reduce((sum, h) => sum + h.kwh, 0)
  
        return {
          id: `ATM-${i + 1}`,
          consumption: total,
          schedule,
          daily//,
          //weekly: generateWeekly(),
          //monthly: generateMonthly()
        }
      })
    }))
  }