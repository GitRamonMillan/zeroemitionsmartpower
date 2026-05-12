import { getEnergy } from '../services/energy.js'
import { getYesterdayEnergy } from '../services/energy.js'
import { state } from '../state/state.js'

const factorEmisionxKWhAnual = 0.2421 //Factor de emisión del Sistema eléctrico Nacional 2023 (SEN) (ANUAL)
const factorEmisionxKWhDiario = factorEmisionxKWhAnual / 365
//fuente : https://huellachile.mma.gob.cl/wp-content/uploads/2024/11/HuellaChile-DCC-Factores-de-emision-nivel-basico_v3.pdf

let branchChart, branchChartCO2, atmChart, hourChart
let selectedBranch = null
let selectedAtm = null
let metaReduccionCO2 = 0.5

let liveInterval = null
let horaActual =  0
let milisegundosDuracionHoraSimulada = 5000
const ultimasHorasReferencia = 2//se calculará la recomendación de apagado según la info de x últimas horas de actividad
const atmCharts = {}

const atmKwhCharts = {}
const atmCo2Charts = {}

const defaultChartOptions = {
    animation: {
      duration: 700,
      easing: "easeOutQuart"
    }
  }

  const hourCharts = {};
  const yesterdayhourCharts = {};

export let yesterday = getYesterdayEnergy()
export let groups = getEnergy()

console.log(state.isRunning);

function computeShutdownMap(groups, yesterdayData) {
    return groups.flatMap(branch =>
      branch.atms.map(atm => {
        // buscar el ATM correspondiente en yesterdayData
        const yesterdayBranch = yesterdayData.find(b => b.name === branch.name)
        const yesterdayATM = yesterdayBranch?.atms.find(a => a.id === atm.id)
  
        console.log(atm);
        const shouldOff = yesterdayATM
          ? shouldShutdownATMWithYesterday(atm, yesterdayATM)
          : false // si no hay data de ayer, default ON
  
        return {
          branch: branch.name,
          atmId: atm.id,
          action: shouldOff ? "OFF" : "ON",
          confidence: 1,// Math.random() * 0.3 + (shouldOff ? 0.7 : 0.2),
          explanation: generateLLMExplanation(atm),
          currentActivityState: atm.daily.at(-1)?.state,
          currentPowerState: atm.powerState
        }
      })
    )
  }

  function shouldShutdownATMWithYesterday(todayATM, yesterdayATM) {
    const lastHours = todayATM.daily.slice(-ultimasHorasReferencia) // últimas 3 horas
  
    // bajo consumo hoy
    const lowConsumption = lastHours.every(h => h.kwh <= 2)
    const isIdleWindow = lastHours.every(h => h.state === "idle")
  
    // consumo histórico ayer para la misma hora
    const yesterdayHours = yesterdayATM.daily.slice(-ultimasHorasReferencia)
    const wasIdleYesterday = yesterdayHours.every(h => h.state === "idle")
    
    // decisión combinada
    return lowConsumption && isIdleWindow && wasIdleYesterday
  }

  function computeATMImpact(groups, shutdownMap) {
    const atmImpact = []
  
    groups.forEach(branch => {
      branch.atms.forEach(atm => {
        let currentKwh = 0
        let optimizedKwh = 0
  
        let currentCO2 = 0
        let optimizedCO2 = 0
  
        const decision = shutdownMap.find(
          d => d.branch === branch.name && d.atmId === atm.id
        )
  
        atm.daily.forEach(hour => {
          currentKwh += hour.kwh
          currentCO2 += hour.co2

          if (
            decision?.action === "OFF" &&
            hour.state === "idle"
          ) {
            return
          }
  
          optimizedKwh += hour.kwh
          optimizedCO2 += hour.co2
        })
  
        atmImpact.push({
          branch: branch.name,
          atmId: atm.id,
  
          currentKwh,
          optimizedKwh,
  
          currentCO2,
          optimizedCO2,
  
          savingsKwh: currentKwh - optimizedKwh,
          savingsCO2: currentCO2 - optimizedCO2
        })
      })
    })
  
    return atmImpact
  }

export function renderEnergy() {
  const shutdownMap = computeShutdownMap(groups, yesterday);

  // aplanar todos los cajeros
  const allAtms = groups.flatMap(g => g.atms);

  const total = allAtms.reduce((sum, a) => sum + a.consumption, 0);
  const avg = Math.round(total / allAtms.length);
  const maxAtm = allAtms.reduce((a, b) => (a.consumption > b.consumption ? a : b));
  const minAtm = allAtms.reduce((a, b) => (a.consumption < b.consumption ? a : b));

  // ================= Charts =================
  function renderBranchChart(data) {
    const ctx = document.getElementById('branchChart');
    const branchData = data.map(branch => ({
      name: branch.name,
      total: branch.atms.reduce((sum, atm) => sum + atm.consumption, 0)
    }));

    if (branchChart) branchChart.destroy();

    branchChart = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: branchData.map(b => b.name),
        datasets: [{ label: 'Consumo total (KWh)', data: branchData.map(b => b.total), backgroundColor: '#4f46e5' }]
      },
      options: { defaultChartOptions }
    });
  }

  function renderBranchChartCO2(data) {
    const ctx = document.getElementById('branchChartCO2');
    const branchData = data.map(branch => ({
      name: branch.name,
      co2: branch.atms.reduce((sum, atm) => sum + atm.co2, 0),
      metaCO2: metaReduccionCO2
    }));

    if (branchChartCO2) branchChartCO2.destroy();

    branchChartCO2 = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: branchData.map(b => b.name),
        datasets: [
          { label: 'CO2 Generado', data: branchData.map(c => c.co2), backgroundColor: '#f59e0b' },
          { label: 'Meta reducción CO2', data: branchData.map(c => c.metaCO2), backgroundColor: '#22c55e' }
        ]
      },
      options: { defaultChartOptions }
    });
  }

  function renderAtmChart(branch) {
    const ctx = document.getElementById('atmChart');
    if (atmChart) atmChart.destroy();

    document.getElementById('atmTitle').innerText = `ATMs - ${branch.name}`;

    const labels = branch.atms.map(atm => atm.id);

    const idleData = branch.atms.map(atm =>
      atm.daily.filter(d => d.state === "idle").reduce((s, d) => s + d.kwh, 0)
    );
    const operationalData = branch.atms.map(atm =>
      atm.daily.filter(d => d.state === "operational").reduce((s, d) => s + d.kwh, 0)
    );
    const peakData = branch.atms.map(atm =>
      atm.daily.filter(d => d.state === "peak_operational").reduce((s, d) => s + d.kwh, 0)
    );

    atmChart = new window.Chart(ctx, {
      type: "bar",
      data: { labels, datasets: [
        { label: "Idle", data: idleData, backgroundColor: "#f59e0b" },
        { label: "Operativo", data: operationalData, backgroundColor: "#22c55e" },
        { label: "Peak", data: peakData, backgroundColor: "#f00000" }
      ] },
      options: {
        defaultChartOptions,
        responsive: true,
        plugins: { legend: { position: "top" } },
        scales: { x: { stacked: true }, y: { stacked: true, title: { display: true, text: "kWh total diario" } } }
      }
    });
  }

  function renderAllATMsChart(groups) {
    const ctx = document.getElementById('atmChart');
    if (atmChart) atmChart.destroy();

    const labels = groups.flatMap(branch => branch.atms.map(atm => atm.id));
    const idleData = groups.flatMap(branch => branch.atms.map(atm => atm.daily.reduce((s, h) => s + (h.state === 'idle' ? h.kwh : 0), 0)));
    const operationalData = groups.flatMap(branch => branch.atms.map(atm => atm.daily.reduce((s, h) => s + (h.state === 'operational' ? h.kwh : 0), 0)));
    const peakData = groups.flatMap(branch => branch.atms.map(atm => atm.daily.reduce((s, h) => s + (h.state === 'peak_operational' ? h.kwh : 0), 0)));

    document.getElementById('atmTitle').innerText = `Todos los ATMs`;

    atmChart = new window.Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [
        { label: 'Idle', data: idleData, backgroundColor: '#f59e0b' },
        { label: 'Operativo', data: operationalData, backgroundColor: '#22c55e' },
        { label: 'Peak', data: peakData, backgroundColor: '#f00000' }
      ] },
      options: {
        defaultChartOptions,
        responsive: true,
        plugins: { legend: { position: "top" } },
        scales: { x: { stacked: true }, y: { stacked: true, title: { display: true, text: "kWh total diario" } } }
      }
    });
  }

  // ================= SetTimeout para inicializar charts =================
  setTimeout(() => {
    renderBranchChart(groups);
    renderBranchChartCO2(groups);

    // Render inicial con todos
    renderShutdownPanel(shutdownMap);
    renderATMPanels(groups);

    const impact = computeCO2Impact(groups, shutdownMap);
    renderCO2Impact(impact);

    startSimulationEngine(({ groups, decisions, impact }) => {
      renderShutdownPanel(decisions);
      renderCO2Impact(impact);
      renderCO2Chart(impact);
      renderBranchChart(groups);

      const atmImpact = computeATMImpact(groups, shutdownMap);
      renderAllATMCharts(atmImpact);
    });

    
//render charts iniciales
    groups.forEach(branch => {
        console.log(branch)
        branch.atms.forEach(atm => {
            console.log("render ATM:", atm);
            renderHourChart({
                ...atm,
                branch: branch.name
            });
        });
    });
    


        

    // // ===== Combobox para filtrar sucursal =====
    // const branchFilter = document.getElementById('branchFilter');
    // branchFilter.addEventListener('change', e => {
    //     const selected = e.target.value;

    //     if (selected === 'all') {
    //         // Mostrar todos
    //         renderShutdownPanel(shutdownMap);
    //         renderATMPanels(groups);
    //     } else {
    //         const branch = groups.find(b => b.name === selected);
    //         const filteredShutdownMap = computeShutdownMap([branch], yesterday);

    //         renderShutdownPanel(filteredShutdownMap);
    //         renderATMPanels([branch]);
    //     }
    // });
}, 0);

  // ================= HTML del Dashboard =================
  return `
    <h2 class="mb-4">⚡ Dashboard Energía</h2>
    <div class="card p-3 mb-3" style="flex: 1; min-width: 150px; text-align:center;">
        <h5>Hora Simulada</h5>
        <div id="horaActualDisplay" style="font-size:24px; font-weight:bold;">00:00</div>

        <div class="mt-3 d-flex justify-content-center gap-2">
            <button id="playPauseBtn" class="btn btn-primary">
                <i class="bi bi-pause-fill"></i>
            </button>
            <button id="resetBtn" class="btn btn-secondary">
                <i class="bi bi-arrow-counterclockwise"></i>
            </button>
        </div>
    </div>

    <div class="row">
    <!--<div id="autopilotPanel" style="display:flex; align-items:center; gap:10px; margin-bottom:15px;">
            <div class="mb-3">
                <label for="autopilotSwitch">Autopilot</label>
                <input type="checkbox" id="autopilotSwitch">
            </div>
            <div class="row align-items-center mb-3">
                <div class="col-auto">
                    <label for="simulatedSeconds" class="col-form-label">Duración de la Hora (segundos):</label>
                </div>
                <div class="col-auto">
                    <input type="number" id="simulatedSeconds" class="form-control simulated-hour-input" placeholder="Enter seconds" min="1" value="5">
                </div>
            </div>
            
            <div class="row align-items-center mb-3">
                <div class="col-auto">
                    <label for="branchFilter">Sucursal:</label>
                </div>
                <div class="col-auto">
                    <select id="branchFilter" class="form-select">
                        <option value="all">Todas</option>
                        ${groups.map(branch => `<option value="${branch.name}">${branch.name}</option>`).join('')}
                    </select>
                </div>
            </div>
        </div>-->
    </div>

    <div class="panel-container">
        <div class="card panel-left p-3 mb-3">
            <h5>Estado</h5>
            <div id="shutdownPanel"></div>
        </div>
        <div class="card panel-right p-3 mb-3">
            <h5>Ayer vs Hoy</h5>
            <div id="atmPanel"></div>
        </div>
    </div>

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

        <!--<div class="card p-3" style="flex: 1; min-width: 300px;">
            <h5>Detalle horario</h5>
            <h5 id="atmTitle">ATMs</h5>
            <h5 id="hourTitle">Detalle horario</h5>
            <canvas id="hourChart"></canvas>
        </div>-->
    </div>
  `;
}

// function renderShutdownPanel(data) {
//     const container = document.getElementById("shutdownPanel")
//     if (!container) return
//   console.log('renderShutdownPanel',data);
//     container.innerHTML = data.map(item => `
//       <div id="atmShutdownPanel" style="padding:10px;border-bottom:1px solid #eee;" data-atmbranch="${item.branch}" data-atmid="${item.atmId}">
//         <div style="display:flex; justify-content:space-between;"
//         <strong style="display:flex; align-items:center; gap:6px;">
//         <span id="statusIndicator" class="indicator ${item.currentActivityState}"></span>${item.branch} - ${item.atmId}</strong>
//           <span style="
//             color:white;
//             background:${item.action === "OFF" ? "#dc2626" : "#16a34a"};
//             padding:2px 8px;
//             border-radius:6px;
//             font-size:12px;
//           ">
//             ${item.action === "OFF" && item.currentPowerState == 1 ? "Apagar" : item.action === "OFF" && item.currentPowerState == 0 ? "Mantener apagado" : item.action === "ON" && item.currentPowerState == 1 ? "Mantener encendido" : "Encender"}
//           </span>
//         </div>
  
//         <div style="font-size:12px; margin-top:4px; color:#555;">
//           IA : ${item.explanation}
//         </div>
  
//         <div style="font-size:11px; color:#999;">
//           confianza: ${Math.round(item.confidence * 100)}%
//         </div>
//         <div class="card p-3" style="flex: 1; min-width: 300px;">
//             Ayer
//             <canvas id="yesterdayhourChart-${item.branch}-${item.atmId}"></canvas>
//         </div>
//         <div class="card p-3" style="flex: 1; min-width: 300px;">
//             Hoy
//             <canvas id="hourChart-${item.branch}-${item.atmId}"></canvas>
//         </div>
//       </div>
//     `).join("")
//   }

function renderShutdownPanel(data) {

    const container = document.getElementById("shutdownPanel");

    if (!container) return;

    data.forEach(item => {

        const branchSafe =
            item.branch.replace(/\s+/g, "_");

        const panelId =
            `atmShutdownPanel-${branchSafe}-${item.atmId}`;

        let panel =
            document.getElementById(panelId);

        // =====================================
        // CREAR SOLO SI NO EXISTE
        // =====================================

        if (!panel) {

            panel = document.createElement("div");

            panel.id = panelId;

            panel.className = "atmShutdownPanel";

            panel.dataset.atmbranch = item.branch;
            panel.dataset.atmid = item.atmId;

            panel.style.padding = "10px";
            panel.style.borderBottom = "1px solid #eee";

            panel.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <strong style="display:flex; align-items:center; gap:6px;">
                        <span class="statusIndicator indicator"></span>
                        <span class="atmTitle"></span>
                    </strong>
                    <span class="atmAction"
                        style="
                            color:white;
                            padding:2px 8px;
                            border-radius:6px;
                            font-size:12px;
                        ">
                    </span>
                </div>
                <div class="atmExplanation"
                    style="font-size:12px; margin-top:4px; color:#555;">
                </div>
                <div class="atmConfidence"
                    style="font-size:11px; color:#999;">
                </div>
                <div id="atmActivityCharts-${branchSafe}-${item.atmId}" class="hidden-div">
                    <div class="card p-3"
                        style="flex:1; min-width:300px;">
                        Ayer
                        <canvas id="yesterdayhourChart-${branchSafe}-${item.atmId}"></canvas>
                    </div>
                    <div class="card p-3"
                        style="flex:1; min-width:300px;">
                        Hoy
                        <canvas id="hourChart-${branchSafe}-${item.atmId}"></canvas>
                    </div>
                </div>
            `;
            container.appendChild(panel);
        }

        // =====================================
        // UPDATE (SIN RECREAR HTML)
        // =====================================

        const indicator =
            panel.querySelector(".statusIndicator");

        indicator.className =
            `statusIndicator indicator ${item.currentActivityState}`;

        panel.querySelector(".atmTitle").textContent =
            `${item.branch} - ${item.atmId}`;

        const action =
            panel.querySelector(".atmAction");

        action.textContent =
            item.action === "OFF" && item.currentPowerState == 1
                ? "Apagar"
                : item.action === "OFF" && item.currentPowerState == 0
                ? "Mantener apagado"
                : item.action === "ON" && item.currentPowerState == 1
                ? "Mantener encendido"
                : "Encender";

        action.style.background =
            item.action === "OFF"
                ? "#dc2626"
                : "#16a34a";

        panel.querySelector(".atmExplanation").textContent =
            `IA : ${item.explanation}`;

        panel.querySelector(".atmConfidence").textContent =
            `confianza: ${Math.round(item.confidence * 100)}%`;
    });
}


  function startSimulationEngine(onUpdate) {
    if (liveInterval) {
        clearInterval(liveInterval)
        liveInterval = null
      }
  
    liveInterval = setInterval(() => {
        if(!state.isRunning) return;
        horaActual+=1
        if (horaActual > 24) {
            groups = getEnergy()
            console.log('Nuevo día iniciado')
        }
        horaActual = horaActual > 24 ? 0:horaActual;

        updateHoraPanel()

        groups.forEach(branch => {
            branch.atms.forEach(atm => {
                updateDailyATM(atm, horaActual)

                // buscar ATM correspondiente en yesterday
                const yesterdayBranch = yesterday.find(b => b.name === branch.name)
                const yesterdayATM = yesterdayBranch?.atms.find(a => a.id === atm.id)

                // actualizar gráfico
                updateATMChart(branch.name, atm, yesterdayATM)

                // actualizar estado ON/OFF visual
                const stateEl = document.getElementById(`state-${branch.name}-${atm.id}`)
                const shouldOff = shouldShutdownATMWithYesterday(atm, yesterdayATM)
                stateEl.textContent = shouldOff ? "OFF" : "ON"

                // groups.forEach(branch => {

                //     branch.atms.forEach(atm => {
            
                        updateHourChart({
                            ...atm,
                            branch: branch.name
                        });
            
                //     });
            
                // });
            })
      })

      const decisions = computeShutdownMap(groups, yesterday)
      const impact = computeCO2Impact(groups, decisions) 
  
      onUpdate({
        groups,
        decisions,
        impact, 
        timestamp: new Date()
      })
      updateCO2Chart(impact) 
            
    }, milisegundosDuracionHoraSimulada)//espera para refresh
  }



  function sendToRelay(decision) {
    console.log(`⚡ [SIMULATED RELAY] ${decision.atmId} → ${decision.action}`)
  }

  function generateLLMExplanation(atm) {
    const lastHours = atm.daily.slice(-ultimasHorasReferencia)
  
    const avgConsumption =
      lastHours.reduce((sum, h) => sum + h.kwh, 0) / lastHours.length
  
    const idleHours = lastHours.filter(h => h.state === "idle").length
  
    const hadRecentPeak = atm.daily
      .slice(-ultimasHorasReferencia)
      .some(h => h.state === "peak_operational")
  
    if (idleHours <= ultimasHorasReferencia && avgConsumption <= 2 && !hadRecentPeak) {
      return "Apagado recomendado: inactividad sostenida y consumo bajo detectado."
    }
  
    if (hadRecentPeak) {
      return "Mantener encendido: actividad reciente en franja peak."
    }
  
    if (avgConsumption > ultimasHorasReferencia) {
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

    console.log('actualizar renderCO2Chart',impact);
  
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

  function generateHourData(schedule, h) {
    console.log('generateHourData',schedule,h)
    const isIdle = schedule.idleHours.includes(h)
    const isPeak = schedule.peakOperationHours.includes(h)
    const isOperating = schedule.operationHours.includes(h)
  
    let state, kwh
  
    if (isIdle) {
      state = "idle"
      kwh = 2//Math.floor(Math.random() * 2) + 1
    } else if (isPeak) {
      state = "peak_operational"
      kwh = 9//Math.floor(Math.random() * 3) + 7
    } else if (isOperating) {
      state = "operational"
      kwh = 6//Math.floor(Math.random() * 4) + 3
    }
  
    const co2 = kwh * factorEmisionxKWhDiario
  
    return { hour: `${h}:00`, state, kwh, co2 }
  }

  function updateDailyATM(atm, horaActual) {
    // generar solo la hora actual
    console.log('updateDailyATM', horaActual,atm.schedule)
    const newHourData = generateHourData(atm.schedule, horaActual)
  
    // agregar al daily
    atm.daily.push(newHourData)
  
    // recalcular totales
    atm.idleKwh = atm.daily.filter(h => h.state === "idle").reduce((sum, h) => sum + h.kwh, 0)
    atm.operationalKwh = atm.daily.filter(h => h.state === "operational").reduce((sum, h) => sum + h.kwh, 0)
    atm.peakKwh = atm.daily.filter(h => h.state === "peak_operational").reduce((sum, h) => sum + h.kwh, 0)
    atm.consumption = atm.idleKwh + atm.operationalKwh + atm.peakKwh
    atm.co2 = atm.daily.reduce((sum, h) => sum + h.co2, 0)
  }

  function renderATMPanels(groups) {
    const panel = document.getElementById("atmPanel")
    panel.innerHTML = "" 
  
    groups.forEach(branch => {
      branch.atms.forEach(atm => {
        const atmDiv = document.createElement("div")
        atmDiv.className = "atm-item"
        atmDiv.id = `atm-${branch.name}-${atm.id}`
  
        // atmDiv.innerHTML = `
        //   <h4>${branch.name} - ${atm.id}</h4>
        //   <div>Estado: <span id="state-${branch.name}-${atm.id}">ON</span></div>
        //   <canvas id="chart-${branch.name}-${atm.id}" width="200" height="100"></canvas>
        // `
        atmDiv.innerHTML = `
            <strong>${branch.name} - ${atm.id}</strong> Estado: <span id="state-${branch.name}-${atm.id}">ON</span>
            <div style="display:flex;
                flex-direction:row;
                gap:12px;
                align-items:center;
                flex-wrap:wrap;">
                <canvas id="chart-${branch.name}-${atm.id}" width="200" height="100"></canvas>
                <canvas 
                    id="kwh-${branch.name}-${atm.id}" 
                    width="220" 
                    height="120">
                </canvas>
                <canvas 
                    id="co2-${branch.name}-${atm.id}" 
                    width="220" 
                    height="120">
                </canvas>
            </div>
            `
        panel.appendChild(atmDiv)
      })
    })
  }

  function updateATMChart(branchName, atm, yesterdayATM) {
    const ctxId = `chart-${branchName}-${atm.id}`
    const ctx = document.getElementById(ctxId).getContext("2d")
  
    const labels = atm.daily.map(h => h.hour) // horas llenadas hasta ahora
  
    const todayDataKwh = atm.daily.map(h => h.kwh)
    const yesterdayDataKwh = yesterdayATM ? yesterdayATM.daily.slice(0, atm.daily.length).map(h => h.kwh) : []
  
    if (atmCharts[ctxId]) {
      // actualizar
      atmCharts[ctxId].data.labels = labels
      atmCharts[ctxId].data.datasets[0].data = todayDataKwh
      atmCharts[ctxId].data.datasets[1].data = yesterdayDataKwh
      atmCharts[ctxId].update()
    } else {
      // crear por primera vez
      atmCharts[ctxId] = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            { label: "Hoy", data: todayDataKwh, borderColor: "blue", fill: false },
            { label: "Ayer", data: yesterdayDataKwh, borderColor: "gray", fill: false, borderDash: [5,5] }
          ]
        },
        options: {
          responsive: false,
          scales: { y: { beginAtZero: true } }
        },
        plugins: {
            title: {
                display: true,
                text: 'Consumo kWh',
                font: {
                    size: 12,
                    weight: 'bold'
                },
                padding: {
                    top: 0,
                    bottom: 5
                }
            }
        }
      })
    }
  }

  function updateHoraPanel() {
    const display = document.getElementById("horaActualDisplay")
    if (!display) return
  
    // Convertimos horaActual a formato HH:00
    const hh = horaActual.toString().padStart(2, "0")
    display.textContent = `${hh}:00`
  }

  

function renderATMkWh(atmKey, atmImpactItem) {
    const ctx = document.getElementById(`kwh-${atmKey}`)
  
    if (!ctx) return
  
    if (atmKwhCharts[atmKey]) {
  
      atmKwhCharts[atmKey].data.datasets[0].data = [
        atmImpactItem.currentKwh,
        atmImpactItem.optimizedKwh
      ]
  
      atmKwhCharts[atmKey].update()
  
      return
    }
  
    atmKwhCharts[atmKey] = new Chart(ctx, {
      type: "bar",
  
      data: {
        labels: ["Actual", "Optimizado"],
  
        datasets: [{
          label: "kWh",
  
          data: [
            atmImpactItem.currentKwh,
            atmImpactItem.optimizedKwh
          ],
  
          backgroundColor: ["#f59e0b", "#22c55e"]
        }]
      },
  
      options: {
        responsive: false,
        animation: {
          duration: 500
        },
        plugins: {
            legend: {
            display: false
        },
            title: {
                display: true,
                text: 'Consumo kWh',
                font: {
                    size: 12,
                    weight: 'bold'
                },
                padding: {
                    top: 0,
                    bottom: 5
                }
            }
        }
      }
    })
  }

function renderATMCo2(atmKey, atmImpactItem) {

    const ctx = document.getElementById(`co2-${atmKey}`)
  
    if (!ctx) return
  
    if (atmCo2Charts[atmKey]) {
  
      atmCo2Charts[atmKey].data.datasets[0].data = [
        atmImpactItem.currentCO2,
        atmImpactItem.optimizedCO2
      ]
  
      atmCo2Charts[atmKey].update()
  
      return
    }
  
    atmCo2Charts[atmKey] = new Chart(ctx, {
      type: "bar",
  
      data: {
        labels: ["Actual", "Optimizado"],
  
        datasets: [{
          label: "CO₂",
  
          data: [
            atmImpactItem.currentCO2,
            atmImpactItem.optimizedCO2
          ],
  
          backgroundColor: ["#ef4444", "#3b82f6"]
        }]
      },
  
      options: {
        responsive: false,
        animation: {
          duration: 500
        },
        plugins: {
            legend: {
                display: false
            },
            title: {
                display: true,
                text: 'CO₂ generado',
                font: {
                    size: 12,
                    weight: 'bold'
                },
                padding: {
                    top: 0,
                    bottom: 5
                }
            }
        }
      }
    })
  }

  function renderAllATMCharts(atmImpact) {

    atmImpact.forEach(item => {
  
      const key = `${item.branch}-${item.atmId}`
  
      renderATMkWh(key, item)
      renderATMCo2(key, item)
  
    })
  }

export function renderHourChart(atm) {
    const canvas = document.getElementById(`hourChart-${atm.branch}-${atm.id}`);
    if (!canvas) return console.warn("Canvas no encontrado:", atm.branch, atm.id);

    const ctx = canvas.getContext("2d");

    if (hourCharts[atm.id]) {
        hourCharts[atm.id].destroy();
    }

    const labels = atm.daily.map(h => h.hour);
    const operational = atm.daily.map(h => h.state === "operational" ? h.kwh : 0);
    const idle = atm.daily.map(h => h.state === "idle" ? h.kwh : 0);
    const peak = atm.daily.map(h => h.state === "peak_operational" ? h.kwh : 0);

    hourCharts[atm.id] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Peak', data: peak, backgroundColor: '#F00000' },
                { label: 'Operativo', data: operational, backgroundColor: '#22c55e' },
                { label: 'Idle', data: idle, backgroundColor: '#f59e0b' }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: { stacked: true },
                y: { stacked: true, title: { display: true, text: "kWh" } }
            }
        }
    });
}

export function renderYesterdayHourChart(atm) {
    const canvas = document.getElementById(`yesterdayhourChart-${atm.branch}-${atm.id}`);
    if (!canvas) return console.warn("Canvas no encontrado:", atm.branch, atm.id);

    const ctx = canvas.getContext("2d");

    if (yesterdayhourCharts[atm.id]) {
        yesterdayhourCharts[atm.id].destroy();
    }

    const labels = atm.daily.map(h => h.hour);
    const operational = atm.daily.map(h => h.state === "operational" ? h.kwh : 0);
    const idle = atm.daily.map(h => h.state === "idle" ? h.kwh : 0);
    const peak = atm.daily.map(h => h.state === "peak_operational" ? h.kwh : 0);

    yesterdayhourCharts[atm.id] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Peak', data: peak, backgroundColor: '#F00000' },
                { label: 'Operativo', data: operational, backgroundColor: '#22c55e' },
                { label: 'Idle', data: idle, backgroundColor: '#f59e0b' }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: { stacked: true },
                y: { stacked: true, title: { display: true, text: "kWh" } }
            }
        }
    });
}

// export function updateHourChart(atm) {
//     console.log('updateHourChart',atm);

//     const chart = hourCharts[atm.id];

//     if (!chart) {
//         console.warn("Chart no existe");
//         return;
//     }

//     // ========================
//     // actualizar labels
//     // ========================

//     chart.data.labels =
//         atm.daily.map(h => h.hour);

//     // ========================
//     // actualizar datasets
//     // ========================

//     chart.data.datasets[0].data =
//         atm.daily.map(h =>
//             h.state === "operational"
//                 ? h.kwh
//                 : 0
//         );

//     chart.data.datasets[1].data =
//         atm.daily.map(h =>
//             h.state === "idle"
//                 ? h.kwh
//                 : 0
//         );

//     // ========================
//     // refrescar chart
//     // ========================

//     chart.update();
// }


export function updateHourChart(atm) {

    const chart = hourCharts[atm.id];

    if (!chart) return;

    const labels = atm.daily.map(h => h.hour);

    const operational = atm.daily.map(h =>
        h.state === "operational" ? h.kwh : 0
    );

    const idle = atm.daily.map(h =>
        h.state === "idle" ? h.kwh : 0
    );

    const peak = atm.daily.map(h =>
        h.state === "peak" || h.state === "peak_operational"
            ? h.kwh
            : 0
    );

    chart.data.labels = labels;

    const op = chart.data.datasets.find(d => d.label === "Operativo");
    const id = chart.data.datasets.find(d => d.label === "Idle");
    const pk = chart.data.datasets.find(d => d.label === "Peak");

    if (op) op.data = operational;
    if (id) id.data = idle;
    if (pk) pk.data = peak;

    chart.update();
}