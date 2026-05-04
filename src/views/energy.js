import { getEnergy } from '../services/energy.js'

let branchChart, atmChart, hourChart
let selectedBranch = null
let selectedAtm = null

export function renderEnergy() {
  const groups = getEnergy()
    console.log(groups);

    const branchEnergy = groups.map(branch => {
        let operational = 0
        let idle = 0
      
        branch.atms.forEach(atm => {
          atm.daily.forEach(hour => {
            if (hour.state === "operational") {
              operational += hour.kwh
            } else {
              idle += hour.kwh
            }
          })
        })
      
        return {
          name: branch.name,
          operational,
          idle
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
      total: branch.atms.reduce((sum, atm) => sum + atm.consumption, 0)
    }))
  
    branchChart = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: branchData.map(b => b.name),
        datasets: [{
          label: 'Consumo total',
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


  function renderBranchChart(data) {
    const ctx = document.getElementById('branchChart')
  
    const branchData = data.map(branch => ({
      name: branch.name,
      total: branch.atms.reduce((sum, atm) => sum + atm.consumption, 0)
    }))
  
    branchChart = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: branchData.map(b => b.name),
        datasets: [{
          label: 'Consumo total',
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


  function renderAtmChart(branch) {
    const ctx = document.getElementById('atmChart')
  
    if (atmChart) atmChart.destroy()
  
        document.getElementById('atmTitle').innerText = `ATMs - ${branch.name}`
    
    atmChart = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: branch.atms.map(a => a.id),
        datasets: [{
          label: `ATMs - ${branch.name}`,
          data: branch.atms.map(a => a.consumption),
          backgroundColor: '#22c55e'
        }]
      },
      options: {
        onClick: (evt, elements) => {
          if (!elements.length) return
  
          const index = elements[0].index
          selectedAtm = branch.atms[index]
  
          renderHourChart(selectedAtm)
        }
      }
    })
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

    document.getElementById('hourTitle').innerText = `Detalle - ${atm.id}`
  
    hourChart = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
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
        scales: {
          x: { stacked: true },
          y: { stacked: true }
        }
      }
    })
  }

setTimeout(() => {
    renderBranchChart(groups)
    // // const ctx = document.getElementById('energyChart')

    // // new window.Chart(ctx, {
    // //   type: 'bar',
    // //   responsive: true,
    // // maintainAspectRatio: false,
    // //   data: {
    // //     labels: groups[0].atms.map(a => a.id),
    // //     datasets: groups.map((g, i) => ({
    // //       label: g.name,
    // //       data: g.atms.map(a => a.consumption),
    // //       backgroundColor: ['#4f46e5', '#22c55e', '#f59e0b'][i]
    // //     }))
    // //   }
    // // })
    // const ctx = document.getElementById('energyChart')

    // new window.Chart(ctx, {
    //     type: 'bar',
    //     data: {
    //       labels: branchEnergy.map(b => b.name),
    //       datasets: [
    //         {
    //           label: 'Operativo',
    //           data: branchEnergy.map(b => b.operational),
    //           backgroundColor: '#22c55e'
    //         },
    //         {
    //           label: 'Idle',
    //           data: branchEnergy.map(b => b.idle),
    //           backgroundColor: '#f59e0b'
    //         }
    //       ]
    //     },
    //     options: {
    //       responsive: true,
    //       maintainAspectRatio: false,
    //       scales: {
    //         x: { stacked: true },
    //         y: { stacked: true }
    //       }
    //     }
    //   })
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

    <div class="card p-3 mb-3">
        <h5>Sucursales</h5>
        <canvas id="branchChart"></canvas>
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