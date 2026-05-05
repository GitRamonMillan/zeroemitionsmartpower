import { getEnergy } from '../services/energy.js'

const factorEmisionxKWhAnual = 0.2421 //Factor de emisión del Sistema eléctrico Nacional 2023 (SEN) (ANUAL)
const factorEmisionxKWhDiario = factorEmisionxKWhAnual / 365
//fuente : https://huellachile.mma.gob.cl/wp-content/uploads/2024/11/HuellaChile-DCC-Factores-de-emision-nivel-basico_v3.pdf

let branchChart, branchChartCO2, atmChart, hourChart
let selectedBranch = null
let selectedAtm = null
let metaReduccionCO2 = 0.5

let liveInterval = null

const defaultChartOptions = {
    animation: {
      duration: 700,
      easing: "easeOutQuart"
    }
  }

function computeShutdownMap(groups) {
    return groups.flatMap(branch =>
      branch.atms.map(atm => {
        const shouldOff = shouldShutdownATM(atm)
  
        return {
          branch: branch.name,
          atmId: atm.id,
          action: shouldOff ? "OFF" : "ON",
          confidence: Math.random() * 0.3 + (shouldOff ? 0.7 : 0.2),
          explanation: generateLLMExplanation(atm) // 👈 nuevo
        }
      })
    )
  }

export function startLiveEnergyEngine() {
  if (liveInterval) clearInterval(liveInterval)

  liveInterval = setInterval(() => {
    const groups = getEnergy()

    const shutdownMap = computeShutdownMap(groups)

    renderShutdownPanel(shutdownMap)

    console.log("live update", shutdownMap)
  }, 5000) // cada 5s (ajustable)
}

export function renderEnergy() {
  const groups = getEnergy()
  const shutdownMap = computeShutdownMap(groups)

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
        defaultChartOptions,
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
        defaultChartOptions,
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
  
    const atm = branch
  
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
            defaultChartOptions,
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
        defaultChartOptions,
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
    renderShutdownPanel(shutdownMap)

    startLiveEnergyEngine() 

      const impact = computeCO2Impact(groups, shutdownMap)
        renderCO2Impact(impact)

        startSimulationEngine(({ groups, decisions, impact }) => {

            renderShutdownPanel(decisions)
            renderCO2Impact(impact)

            renderCO2Chart(impact) 
            renderBranchChart(groups)

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

    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <div class="card p-3 mb-3" style="flex: 1; min-width: 300px;">
            <h5>Estado</h5>
            <div id="shutdownPanel"></div>
        </div>
        <div class="card p-3 mb-3" style="flex: 1; min-width: 300px;">
            <h5>Impacto CO₂ en Tiempo Real</h5>
            <div id="co2ImpactPanel"></div>
        </div>
        <div class="card p-3 mb-3">
            <h5>CO₂ por Sucursal (Antes vs Optimizado)</h5>
            <canvas id="co2BranchChart"></canvas>
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

    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <div class="card p-3 mb-3" style="flex: 1; min-width: 300px;">
            <h5>ATMs</h5>
            <canvas id="atmChart"></canvas>
        </div>

        <div class="card p-3" style="flex: 1; min-width: 300px;">
            <h5>Detalle horario</h5>
            <h5 id="atmTitle">ATMs</h5>
            <h5 id="hourTitle">Detalle horario</h5>
            <canvas id="hourChart"></canvas>
        </div>
    </div>
  `
}

function renderShutdownPanel(data) {
    const container = document.getElementById("shutdownPanel")
    if (!container) return
  
    container.innerHTML = data.map(item => `
      <div style="
        padding:10px;
        border-bottom:1px solid #eee;
      ">
        <div style="display:flex; justify-content:space-between;">
          <strong>${item.branch} - ${item.atmId}</strong>
  
          <span style="
            color:white;
            background:${item.action === "OFF" ? "#dc2626" : "#16a34a"};
            padding:2px 8px;
            border-radius:6px;
            font-size:12px;
          ">
            ${item.action}
          </span>
        </div>
  
        <div style="font-size:12px; margin-top:4px; color:#555;">
          IA : ${item.explanation}
        </div>
  
        <div style="font-size:11px; color:#999;">
          confianza: ${Math.round(item.confidence * 100)}%
        </div>
      </div>
    `).join("")
  }

  function shouldShutdownATM(atm) {
    const lastHours = atm.daily.slice(-3)
  
    const lowConsumption = lastHours.every(h => h.kwh <= 2)
    const allIdle = lastHours.every(h => h.state === "idle")
  
    // más realista: ventana reciente más amplia
    const recentPeak = atm.daily
      .slice(-8)
      .some(h => h.state === "peak_operational")
  
    // evitar falsos positivos si aún hay operación parcial
    const hasAnyOperational = lastHours.some(h => h.state === "operational")
  
    return lowConsumption && allIdle && !recentPeak && !hasAnyOperational
  }

  //motor de simulacion
  function startSimulationEngine(onUpdate) {
    if (liveInterval) {
        clearInterval(liveInterval)
        liveInterval = null
      }
  
    liveInterval = setInterval(() => {
      const groups = getEnergy()
  
      const decisions = computeShutdownMap(groups)
      const impact = computeCO2Impact(groups, decisions) 
  
      onUpdate({
        groups,
        decisions,
        impact, 
        timestamp: new Date()
      })
      updateCO2Chart(impact) 
            
    }, 5000)//espera para refresh
  }

  

  function updateCharts(groups) {
    if (!branchChart) return
  
    const totals = groups.map(b =>
      b.atms.reduce((sum, atm) => sum + atm.consumption, 0)
    )
  
    branchChart.data.datasets[0].data = totals
    branchChart.update()
  
    if (!branchChartCO2) return
  
    const totals2 = groups.map(b =>
      b.atms.reduce((sum, atm) => sum + atm.consumption, 0)
    )
  
    branchChartCO2.data.datasets[0].data = totals2
    branchChartCO2.update()

    
  }

  function sendToRelay(decision) {
    console.log(`⚡ [SIMULATED RELAY] ${decision.atmId} → ${decision.action}`)
  }

  function generateLLMExplanation(atm) {
    const lastHours = atm.daily.slice(-3)
  
    const avgConsumption =
      lastHours.reduce((sum, h) => sum + h.kwh, 0) / lastHours.length
  
    const idleHours = lastHours.filter(h => h.state === "idle").length
  
    const hadRecentPeak = atm.daily
      .slice(-8)
      .some(h => h.state === "peak_operational")
  
    //lógica estilo LLM
    if (idleHours === 3 && avgConsumption <= 2 && !hadRecentPeak) {
      return "Apagado recomendado: inactividad sostenida y consumo bajo detectado."
    }
  
    if (hadRecentPeak) {
      return "Mantener encendido: actividad reciente en franja peak."
    }
  
    if (avgConsumption > 3) {
      return "Mantener encendido: consumo indica uso activo del ATM."
    }
  
    return "Estado estable: sin condiciones claras para apagado."
  }

function computeCO2Impact(groups, shutdownMap) {
    const branchImpact = []
  
    let totalCurrent = 0
    let totalOptimized = 0
  
    groups.forEach(branch => {
      let currentCO2 = 0
      let optimizedCO2 = 0
  
      branch.atms.forEach(atm => {
        atm.daily.forEach(hour => {
          currentCO2 += hour.co2
        })
      })
  
      shutdownMap
        .filter(item => item.branch === branch.name)
        .forEach(item => {
          const atm = branch.atms.find(a => a.id === item.atmId)
  
          atm.daily.forEach(hour => {
            if (item.action === "OFF" && hour.state === "idle") {
              return // ahorro
            }
            optimizedCO2 += hour.co2
          })
        })
  
      const savings = currentCO2 - optimizedCO2
  
      totalCurrent += currentCO2
      totalOptimized += optimizedCO2
  
      branchImpact.push({
        branch: branch.name,
        currentCO2,
        optimizedCO2,
        savings
      })
    })
  
    return {
      branches: branchImpact,
      total: {
        currentCO2: totalCurrent,
        optimizedCO2: totalOptimized,
        savings: totalCurrent - totalOptimized
      }
    }
  }

  function renderCO2Impact(impact) {
    const el = document.getElementById("co2ImpactPanel")
    if (!el) return
  
    el.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px;">
  
        ${impact.branches.map(b => `
          <div style="
            border:1px solid #eee;
            border-radius:8px;
            padding:10px;
          ">
            <strong>${b.branch}</strong>
  
            <div style="display:flex; gap:15px; margin-top:5px; font-size:13px;">
              <div>Actual: ${b.currentCO2.toFixed(2)}</div>
              <div>Optimizado: ${b.optimizedCO2.toFixed(2)}</div>
              <div style="color:#16a34a;">
                Ahorro: ${b.savings.toFixed(2)}
              </div>
            </div>
          </div>
        `).join("")}
  
        <hr/>
  
        <div style="font-size:14px;">
          <strong>Total Red</strong><br>
          ${impact.total.savings.toFixed(2)} kg CO₂ evitables
        </div>
  
      </div>
    `
  }

  let co2Chart = null

function renderCO2Chart(impact) {
  const ctx = document.getElementById("co2BranchChart")
  if (!ctx) return

  // destruir si ya existe (importante)
  if (co2Chart) co2Chart.destroy()

  const labels = impact.branches.map(b => b.branch)

  const currentData = impact.branches.map(b => b.currentCO2)
  const optimizedData = impact.branches.map(b => b.optimizedCO2)

  co2Chart = new window.Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "CO₂ Actual",
          data: currentData,
          backgroundColor: "#f59e0b"
        },
        {
          label: "CO₂ Optimizado",
          data: optimizedData,
          backgroundColor: "#22c55e"
        }
      ]
    },
    options: {
        defaultChartOptions,
        responsive: true,
        plugins: {
          legend: {
            position: "top"
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${context.raw.toFixed(2)} kg`
              },
              afterLabel: function(context) {
                const i = context.dataIndex
      
                const ahorro =
                  impact.branches[i].currentCO2 -
                  impact.branches[i].optimizedCO2
      
                return `Ahorro: ${ahorro.toFixed(2)} kg`
              }
            }
          }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: "kg CO₂"
            }
          }
        }
      }
  })
}

function updateCO2Chart(impact) {
    if (!co2Chart) return
  
    const newCurrent = impact.branches.map(b => b.currentCO2)
    const newOptimized = impact.branches.map(b => b.optimizedCO2)
    //const newSavings = impact.branches.map(b => b.savings)
  
    co2Chart.data.datasets[0].data = newCurrent
    co2Chart.data.datasets[1].data = newOptimized
    //co2Chart.data.datasets[2].data = newSavings
  
    co2Chart.update({
      duration: 600,
      easing: "easeOutQuart"
    })

    co2Chart.data.datasets[1].backgroundColor = "#60a5fa"

    setTimeout(() => {
    co2Chart.data.datasets[1].backgroundColor = "#3b82f6"
    co2Chart.update()
    }, 300)
  }