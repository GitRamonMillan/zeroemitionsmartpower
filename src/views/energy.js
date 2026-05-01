import { getEnergy } from '../services/energy.js'

let chartInstance = null

export async function renderEnergy() {
    const data = await getEnergy()
  
    setTimeout(() => {
      const ctx = document.getElementById('energyChart')
  
      new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.map((_, i) => `Día ${i + 1}`),
          datasets: [{
            label: 'Consumo energía',
            data: data,
            backgroundColor: '#4f46e5'
          }]
        }
      })
    }, 0)
  
    return `
      <h2>⚡ Energía</h2>
      <canvas id="energyChart"></canvas>
    `
  }