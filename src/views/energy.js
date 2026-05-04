import { getEnergy } from '../services/energy.js'

const factorEmisionxKWhAnual = 0.2421 //Factor de emisión del Sistema eléctrico Nacional 2023 (SEN) (ANUAL)
const factorEmisionxKWhDiario = factorEmisionxKWhAnual / 365
//fuente : https://huellachile.mma.gob.cl/wp-content/uploads/2024/11/HuellaChile-DCC-Factores-de-emision-nivel-basico_v3.pdf

let branchChart, branchChartCO2, atmChart, hourChart
let selectedBranch = null
let selectedAtm = null
let metaReduccionCO2 = 0.5

export function renderEnergy() {
  const groups = getEnergy()
    console.log(groups);

    const branchEnergy = groups.map(branch => {
        let operational = 0
        let idle = 0
        let kwh = 0
        let co2 = 0
      
        branch.atms.forEach(atm => {
          atm.daily.forEach(hour => {
            if (hour.state === "operational") {
              operational += hour.kwh
            } else {
              idle += hour.kwh
            }
            kwh += hour.kwh
            co2 += kwh * factorEmisionxKWhDiario
          })
        })
      
        return {
          name: branch.name,
          operational,
          idle,
          kwh,
          co2
        }
    })

    console.log(branchEnergy);

    

      

      //detecta peor sucursal
      const worst = branchEnergy.reduce((a, b) =>
        a.idle > b.idle ? a : b
      )
      console.log(worst);

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


  function renderBranchChart(data) {
    const ctx = document.getElementById('branchChart')
  
    const branchData = data.map(branch => ({
      name: branch.name,
      total: branch.atms.reduce((sum, atm) => sum + atm.consumption, 0),
      co2: branch.atms.reduce((sum, atm) => sum + atm.co2, 0)
    }))

    console.log('branchData',branchData)
  
    branchChart = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: branchData.map(b => b.name),
        datasets: [{
          label: 'Consumo total (KWh)',
          data: branchData.map(b => b.total),
          backgroundColor: '#4f46e5'
        }]
      },
      options: {
        onClick: (evt, elements) => {
          if (!elements.length) return
  
          const index = elements[0].index
          selectedBranch = data[index]
  
          renderAtmChart(selectedBranch)
        }
      }
    })
  }

  function renderBranchChartCO2(data) {
    const ctx = document.getElementById('branchChartCO2')
  
    const branchData = data.map(branch => ({
      name: branch.name,
      total: branch.atms.reduce((sum, atm) => sum + atm.consumption, 0),
      co2: branch.atms.reduce((sum, atm) => sum + atm.co2, 0),
      metaCO2: metaReduccionCO2
    }))

    console.log('branchChartCO2',branchData)
  
    branchChartCO2 = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: branchData.map(b => b.name),
        datasets: [{
          label: 'CO2 Generado',
          data: branchData.map(c => c.co2),
          backgroundColor: '#f59e0b'
        },
        {
            label: 'Meta reducción CO2',
            data: branchData.map(c => c.metaCO2),
            backgroundColor: '#22c55e'
          }]
      },
      options: {
        onClick: (evt, elements) => {
          if (!elements.length) return
  
          const index = elements[0].index
          selectedBranch = data[index]
  
          renderAtmChart(selectedBranch)
        }
      }
    })
  }

  function renderAtmChart(branch) {
    const ctx = document.getElementById('atmChart')
  
    if (atmChart) atmChart.destroy()
  
    document.getElementById('atmTitle').innerText = `ATMs - ${branch.name}`
  
    // 👉 IMPORTANTE: tomar ATMs del branch
    const atm = branch//.atms[0] // o el que estés seleccionando
  
    const daily = atm.daily
  
    const labels = branch.atms.map(atm => atm.id)

    const idleData = branch.atms.map(atm =>
    atm.daily
        .filter(d => d.state === "idle")
        .reduce((s, d) => s + d.kwh, 0)
    )

    const operationalData = branch.atms.map(atm =>
    atm.daily
        .filter(d => d.state === "operational")
        .reduce((s, d) => s + d.kwh, 0)
    )

    const peakData = branch.atms.map(atm =>
    atm.daily
        .filter(d => d.state === "peak_operational")
        .reduce((s, d) => s + d.kwh, 0)
    )
  
      atmChart = new window.Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Idle",
              data: idleData,
              backgroundColor: "#f59e0b"
            },
            {
              label: "Operativo",
              data: operationalData,
              backgroundColor: "#22c55e"
            },
            {
              label: "Peak",
              data: peakData,
              backgroundColor: "#f00000"
            }
          ]
        },
        options: {
            onClick: (evt, elements) => {
            if (!elements.length) return
    
            const index = elements[0].index
            selectedAtm = branch.atms[index]
    
            renderHourChart(selectedAtm)},
          responsive: true,
          plugins: {
            legend: {
              position: "top"
            }
          },
          scales: {
            x: {
              stacked: true
            },
            y: {
              stacked: true,
              title: {
                display: true,
                text: "kWh total diario"
              }
            }
          }
        }
      })

//   function renderAtmChart(branch) {
//     const ctx = document.getElementById('atmChart')
  
//     if (atmChart) atmChart.destroy()
  
//         document.getElementById('atmTitle').innerText = `ATMs - ${branch.name}`
    
//         atmChart = new window.Chart(ctx, {
//             type: "bar",
//             data: {
//               labels: ["ATM Total"],
//               datasets: [
//                 {
//                   label: "Idle",
//                   data: [idleKwh],
//                   backgroundColor: "#94a3b8"
//                 },
//                 {
//                   label: "Operational",
//                   data: [operationalKwh],
//                   backgroundColor: "#3b82f6"
//                 },
//                 {
//                   label: "Peak",
//                   data: [peakKwh],
//                   backgroundColor: "#ef4444"
//                 }
//               ]
//             },
//             options: {
//               responsive: true,
//               plugins: {
//                 legend: {
//                   position: "top"
//                 }
//               },
//               scales: {
//                 x: {
//                   stacked: true
//                 },
//                 y: {
//                   stacked: true,
//                   title: {
//                     display: true,
//                     text: "kWh total diario"
//                   }
//                 }
//               }
//             }
//           })

//     // atmChart = new window.Chart(ctx, {
//     //   type: 'bar',
//     //   data: {
//     //     labels: branch.atms.map(a => a.id),
//     //     datasets: [{
//     //         label: 'Peak Operativo',//`ATMs - ${branch.name}`,
//     //         data: branch.atms.map(a => a.peakKwh),// branch.atms.map(a => a.consumption),
//     //         backgroundColor: '#f00000'
//     //       },
//     //     {
//     //       label: 'Operativo',//`ATMs - ${branch.name}`,
//     //       data: branch.atms.map(a => a.operationalKwh),// branch.atms.map(a => a.consumption),
//     //       backgroundColor: '#22c55e'
//     //     },
//     //     {
//     //         label: 'Idle',//`ATMs - ${branch.name}`,
//     //         data: branch.atms.map(a => a.idleKwh),// branch.atms.map(a => a.consumption),
//     //         backgroundColor: '#f59e0b'
//     //       }]
//     //   },
//     //   options: {
//     //     onClick: (evt, elements) => {
//     //       if (!elements.length) return
  
//     //       const index = elements[0].index
//     //       selectedAtm = branch.atms[index]
  
//     //       renderHourChart(selectedAtm)
//     //     }
//     //   }
//     // })
  }


  function renderHourChart(atm) {
    const ctx = document.getElementById('hourChart')
  
    if (hourChart) hourChart.destroy()
  
    const labels = atm.daily.map(h => h.hour)
  
    const operational = atm.daily.map(h =>
      h.state === "operational" ? h.kwh : 0
    )
  
    const idle = atm.daily.map(h =>
      h.state === "idle" ? h.kwh : 0
    )

    const peak = atm.daily.map(h =>
        h.state === "peak_operational" ? h.kwh : 0
      )

    document.getElementById('hourTitle').innerText = `Detalle - ${atm.id}`
  
    hourChart = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
        {
            label: 'Peak',
            data: peak,
            backgroundColor: '#F00000'
        },
        {
            label: 'Operativo',
            data: operational,
            backgroundColor: '#22c55e'
          },
          {
            label: 'Idle',
            data: idle,
            backgroundColor: '#f59e0b'
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          x: {
            stacked: true
          },
          y: {
            stacked: true,
            title: {
              display: true,
              text: "kWh"
            }
          }
        }
      }
    })
  }

setTimeout(() => {
    renderBranchChart(groups)
    renderBranchChartCO2(groups)
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
    <!--<div class="card p-3">
      <canvas id="energyChart"></canvas>
    </div>-->

    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
    
        <div class="card p-3 mb-3" style="flex: 1; min-width: 300px;">
            <h5>Sucursales</h5>
            <canvas id="branchChart"></canvas>
        </div>

        <div class="card p-3 mb-3" style="flex: 1; min-width: 300px;">
            <h5>Sucursales</h5>
            <canvas id="branchChartCO2"></canvas>
        </div>

    </div>

    <div class="card p-3 mb-3">
        <h5>ATMs</h5>
        <canvas id="atmChart"></canvas>
    </div>

    <div class="card p-3">
        <h5>Detalle horario</h5>
        <h5 id="atmTitle">ATMs</h5>
        <h5 id="hourTitle">Detalle horario</h5>
        <canvas id="hourChart"></canvas>
    </div>
  `
}