import Chart from 'chart.js/auto'
import { getEnergy } from '../services/energy.js'

let chartInstance = null

export async function renderEnergy() {
  const data = await getEnergy()

  setTimeout(() => {
    const ctx = document.getElementById('energyChart')

    // destruir gráfico anterior si existe (evita duplicados)
    if (chartInstance) {
      chartInstance.destroy()
    }

    chartInstance = new Chart(ctx, {
      type: 'line',
      backgroundColor: 'rgba(79, 70, 229, 0.5)',
        borderColor: '#4f46e5',
      data: {
        labels: data.map((_, i) => `Día ${i + 1}`),
        datasets: [{
            tension: 0.4,
            fill: true
          }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true }
        }
      }
    })
  }, 0)

  return `
    <h2>⚡ Consumo de energía</h2>

    <div class="card p-3 mt-3">
      <canvas id="energyChart"></canvas>
    </div>
  `
}