import { api } from '../api/api.js'

const factorEmisionxKWhAnual = 0.2421 //Factor de emisión del Sistema eléctrico Nacional 2023 (SEN) (ANUAL)
const factorEmisionxKWhDiario = factorEmisionxKWhAnual / 365
//fuente : https://huellachile.mma.gob.cl/wp-content/uploads/2024/11/HuellaChile-DCC-Factores-de-emision-nivel-basico_v3.pdf

const probabilidadHoraPeak =  0.25
const cajerosPorSucursal = 3

export function updateEnergy(values) {
  return api.updateEnergy(values)
}

export function getEnergy() {
  const groups = ["Agustinas", "Huérfanos", "Moneda"]

  function generateSchedule() {
    const start = Math.floor(Math.random() * 4) + 7
    const duration = Math.floor(Math.random() * 6) + 10
    const operationHours = Array.from({ length: duration }, (_, i) => (start + i) % 24)
    const peakOperationHours = operationHours.filter(h => {
      const isPeakWindow = (h >= 9 && h <= 11) || (h >= 17 && h <= 19)
      return isPeakWindow && Math.random() < probabilidadHoraPeak
    })
    const idleHours = Array.from({ length: 24 }, (_, h) => h).filter(h => !operationHours.includes(h))
    return { operationHours, peakOperationHours, idleHours }
  }

  return groups.map(group => ({
    name: group,
    atms: Array.from({ length: cajerosPorSucursal }, (_, i) => {
      const schedule = generateSchedule()
      return {
        id: `ATM-${i + 1}`,
        schedule,
        daily: [], // empezamos vacío
        idleKwh: 0,
        operationalKwh: 0,
        peakKwh: 0,
        consumption: 0,
        co2: 0,
        powerState: 1
      }
    })
  }))
}


  export function getYesterdayEnergy() {
    const groups = ["Agustinas", "Huérfanos", "Moneda"]
  
    function generateSchedule() {
        const start = Math.floor(Math.random() * 4) + 7 // 7–10
        const duration = Math.floor(Math.random() * 6) + 10 // 10–16 horas operativas
      
        const operationHours = Array.from(
          { length: duration },
          (_, i) => (start + i) % 24
        )
      
        const peakOperationHours = operationHours.filter(h => {
          const isPeakWindow =
            (h >= 9 && h <= 11) || (h >= 17 && h <= 19)
      
          const isRandomPeak = Math.random() < probabilidadHoraPeak // 25% de chance
      
          return isPeakWindow && isRandomPeak
        })
      
        const idleHours = Array.from({ length: 24 }, (_, h) => h)
          .filter(h => !operationHours.includes(h))
      
        return {
          operationHours,
          peakOperationHours,
          idleHours
        }
      }
  
    function generateDaily(schedule) {
        return Array.from({ length: 24 }, (_, h) => {
      
          const isIdle = schedule.idleHours.includes(h)
          const isPeak = schedule.peakOperationHours.includes(h)
          const isOperating = schedule.operationHours.includes(h)
      
          let state
          let kwh
      
          if (isIdle) {
            state = "idle"
            kwh = 2//Math.floor(Math.random() * 2) + 1 // 1–2 kWh
          } 
          else if (isPeak) {
            state = "peak_operational"
            kwh = 9//Math.floor(Math.random() * 3) + 7 // 7–9 kWh (más alto)
          } 
          else if (isOperating) {
            state = "operational"
            kwh = 6//Math.floor(Math.random() * 4) + 3 // 3–6 kWh
          }
      
          const co2 = kwh * factorEmisionxKWhDiario
      
          return {
            hour: `${h}:00`,
            state,
            kwh,
            co2
          }
        })
      }
  
    return groups.map(group => ({
      name: group,
      atms: Array.from({ length: cajerosPorSucursal }, (_, i) => {
        const schedule = generateSchedule()
        const daily = generateDaily(schedule)
        const total = daily.reduce((sum, h) => sum + h.kwh, 0)
        const co2 = daily.reduce((sum, h) => sum + h.co2, 0)
        const idleKwh = daily
            .filter(h => h.state === "idle")
            .reduce((sum, h) => sum + h.kwh, 0)

        const operationalKwh = daily
            .filter(h => h.state === "operational")
            .reduce((sum, h) => sum + h.kwh, 0)
        
        const peakKwh = daily
            .filter(h => h.state === "peak_operational")
            .reduce((sum, h) => sum + h.kwh, 0)
  
        const totalKwh = idleKwh + operationalKwh + peakKwh

        return {
          id: `ATM-${i + 1}`,
          //consumption: total,
          consumption: totalKwh,
          co2: co2,
          idleKwh: idleKwh,
          operationalKwh: operationalKwh,
          peakKwh: peakKwh,
          schedule,
          daily
          ///weekly: generateWeekly(),
          ///monthly: generateMonthly()
        }
      })
    }))
  }


  