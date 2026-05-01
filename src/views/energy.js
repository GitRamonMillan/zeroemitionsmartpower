import { getEnergy } from '../services/energy.js'

export function renderEnergy() {
  const groups = getEnergy()

  // aplanar todos los cajeros
  const allAtms = groups.flatMap(g => g.atms)

  const total = allAtms.reduce((sum, a) => sum + a.consumption, 0)
  const avg = Math.round(total / allAtms.length)

  const maxAtm = allAtms.reduce((a, b) =>
    a.consumption > b.consumption ? a : b
  )

  const minAtm = allAtms.reduce((a, b) =>
    a.consumption < b.consumption ? a : b
  )

// import { getEnergy } from '../services/energy.js'

// let chartInstance = null

// // export async function renderEnergy() {
// //     const data = await getEnergy()
  
// //     setTimeout(() => {
// //       const ctx = document.getElementById('energyChart')
  
// //       new window.Chart(ctx, {
// //         type: 'line',
// //         data: {
// //           labels: data.map((_, i) => `Día ${i + 1}`),
// //           datasets: [{
// //             label: 'Consumo energía',
// //             data: data,
// //             backgroundColor: '#4f46e5'
// //           }]
// //         }
// //       })
// //     }, 0)
  
// //     return `
// //       <h2>⚡ Energía</h2>
// //       <canvas id="energyChart"></canvas>
// //     `
// //   }
// export function renderEnergy() {
//     const groups = getEnergy()
  
//     const labels = groups.map(g => g.name)
  
//     const totals = groups.map(g =>
//       g.atms.reduce((sum, atm) => sum + atm.consumption, 0)
//     )
  
//     setTimeout(() => {
//       const ctx = document.getElementById('energyChart')
  
//       new window.Chart(ctx, {
//         type: 'bar',
//         data: {
//           labels: labels,
//           datasets: [{
//             label: 'Consumo total por sucursal (kWh)',
//             data: totals,
//             backgroundColor: ['#4f46e5', '#22c55e', '#f59e0b']
//           }]
//         },
//         options: {
//           responsive: true
//         }
//       })
//     }, 0)
  
//     return `
//       <h2>⚡ Consumo por sucursal</h2>
//       <canvas id="energyChart"></canvas>
//     `
//   }

setTimeout(() => {
    const ctx = document.getElementById('energyChart')

    new window.Chart(ctx, {
      type: 'bar',
      responsive: true,
    maintainAspectRatio: false,
      data: {
        labels: groups[0].atms.map(a => a.id),
        datasets: groups.map((g, i) => ({
          label: g.name,
          data: g.atms.map(a => a.consumption),
          backgroundColor: ['#4f46e5', '#22c55e', '#f59e0b'][i]
        }))
      }
    })
  }, 0)

  return `
    <h2 class="mb-4">⚡ Dashboard Energía</h2>

    <!-- KPIs -->
    <div class="row mb-4">

      <div class="col-md-3">
        <div class="card p-3 shadow-sm border-start border-4 border-primary">
          <h6>Consumo total</h6>
          <h3>${total} kWh</h3>
        </div>
      </div>

      <div class="col-md-3">
        <div class="card p-3 shadow-sm border-start border-4 border-success">
          <h6>Promedio ATM</h6>
          <h3>${avg} kWh</h3>
        </div>
      </div>

      <div class="col-md-3">
        <div class="card p-3 shadow-sm border-start border-4 border-danger">
          <h6>Mayor consumo</h6>
          <h5>${maxAtm.id}</h5>
          <small>${maxAtm.consumption} kWh</small>
        </div>
      </div>

      <div class="col-md-3">
        <div class="card p-3 shadow-sm border-start border-4 border-warning">
          <h6>Más eficiente</h6>
          <h5>${minAtm.id}</h5>
          <small>${minAtm.consumption} kWh</small>
        </div>
      </div>

    </div>

    <!-- CHART -->
    <div class="card p-3">
      <canvas id="energyChart"></canvas>
    </div>
  `
}