import { getEnergy } from '../services/energy.js'
import { getYesterdayEnergy } from '../services/energy.js'
import { state } from '../state/state.js'
import {
  renderBranchChart,
  renderBranchChartCO2,
  renderAtmChart
} from './graphs.js';

const factorEmisionxKWhAnual = 0.2421 //Factor de emisión del Sistema eléctrico Nacional 2023 (SEN) (ANUAL)
const factorEmisionxKWhDiario = 0.3;//factorEmisionxKWhAnual / 365
//fuente : https://huellachile.mma.gob.cl/wp-content/uploads/2024/11/HuellaChile-DCC-Factores-de-emision-nivel-basico_v3.pdf

let branchChart, branchChartCO2, atmChart, hourChart
let selectedBranch = null
let selectedAtm = null
let metaReduccionCO2 = 0.5

let liveInterval = null
let horaActual =  0
let milisegundosDuracionHoraSimulada = 5000
const ultimasHorasReferencia = 2//se calculará la recomendación de apagado según la info de x últimas horas de actividad del historico vs la actividade de la hora actual
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

let simulationRunning = false;

  function shouldShutdownATMWithYesterday_fallback(todayATM, yesterdayATM) {
    const lastHours = todayATM.daily.slice(horaActual-ultimasHorasReferencia) // últimas 3 horas
    const currentHour = todayATM.daily.slice(-1) // últimas 3 horas
    
    // bajo consumo hoy
    const lowConsumption = lastHours.every(h => h.kwh <= 100)
    const isIdleWindow = lastHours.every(h => h.state === "idle")
  
    // consumo histórico ayer para la misma hora
    const yesterdayHours = Array.from(
      { length: ultimasHorasReferencia },
      (_, i) => {
        const index =
          (horaActual - ultimasHorasReferencia + i + yesterdayATM.daily.length) %
          yesterdayATM.daily.length
    
        return yesterdayATM.daily[index]
      }
    )
    
    const wasIdleYesterday = yesterdayHours.every(h => h.state === "idle")
    
    const notAtPeak = currentHour.state != "peak"

    return lowConsumption && isIdleWindow && wasIdleYesterday && notAtPeak
  }

  async function computeShutdownMap(groups, yesterdayData) {
    return Promise.all(
      groups.flatMap(async branch =>
        Promise.all(
          branch.atms.map(async atm => {
            
            const yesterdayBranch = yesterdayData.find(b => b.name === branch.name);
            const yesterdayATM = yesterdayBranch?.atms.find(a => a.id === atm.id);
  
            let shouldOff = false
            const result = await shouldShutdownATMWithYesterdayLLM(atm, yesterdayATM);

            if(state.useLLMAPI){
              if (result.decision === "OFF") {
                shouldOff = true
              }
  
              if (result.decision === "ON") {
                shouldOff = false
              }
            }
            else shouldOff = result

            console.log(shouldOff,result.reason, result.confidence);

            let explanation = state.useLLMAPI ? result.reason : generateLLMExplanation(atm);
            let confidence = state.useLLMAPI ? result.confidence : Math.random() * 0.3 + (shouldOff ? 0.7 : 0.2);
  
            return {
              branch: branch.name,
              atmId: atm.id,
              action: shouldOff ? "OFF" : "ON",
              confidence: confidence,
              explanation: explanation,
              currentActivityState: atm.daily.at(-1)?.state,
              currentPowerState: atm.powerState,
              currentAutomaticMode: atm.automaticMode
            };
          })
        )
      )
    );
  }

  function buildLLMInput(atm) {
    const { schedule, daily } = atm;
  
    return daily.map((h) => {
      const hourNumber = parseInt(h.hour.split(":")[0], 10);
  
      let state = "operational";
  
      if (schedule.peakOperationHours.includes(hourNumber)) {
        state = "peak";
      } else if (schedule.idleHours.includes(hourNumber)) {
        state = "idle";
      }
  
      return {
        hour: h.hour,
        state,        // recalculado desde schedule (no confías solo en backend)
        kwh: h.kwh
      };
    });
  }

  function cleanLLMText(text) {
    if (!text) return "";
  
    return text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
  }

  function shouldShutdownATMWithYesterdayLLM(todayATM, yesterdayATM) {
    return new Promise((resolve) => {
      console.log('state.useLLMAPI',state.useLLMAPI)
      if(!state.useLLMAPI) {
        return resolve(shouldShutdownATMWithYesterday_fallback(todayATM,yesterdayATM))
      }
      console.log('using LLM model...');

      const currentHour = todayATM.daily.at(-1)
      if (!currentHour) return resolve(false)
    
      const startIndex = Math.max(0, horaActual - ultimasHorasReferencia)
      const lastHours = todayATM.daily.slice(startIndex)
    
      if (lastHours.length === 0) return false
    
      const lowConsumption = lastHours.every(h => h?.kwh <= 100)
      const isIdleWindow = lastHours.every(h => h?.state === "idle")
    
      const yesterdayHours = Array.from(
        { length: ultimasHorasReferencia },
        (_, i) => {
          const index =
            (horaActual - ultimasHorasReferencia + i + yesterdayATM.daily.length) %
            yesterdayATM.daily.length
    
          return yesterdayATM.daily[index]
        }
      ).filter(Boolean)
    
      const wasIdleYesterday = yesterdayHours.every(h => h?.state === "idle")
      const notAtPeak = currentHour?.state !== "peak"
    
      const todayLLMInput = buildLLMInput(todayATM);
      const yesterdayLLMInput = buildLLMInput(yesterdayATM);


      const prompt = `
          Eres un sistema experto en gestión energética de ATMs.

          Debes decidir el estado del ATM basado en consumo y actividad.

          Reglas base:
          - lowConsumption: ${lowConsumption}
          - isIdleWindow: ${isIdleWindow}
          - wasIdleYesterday: ${wasIdleYesterday}
          - notAtPeak: ${notAtPeak}

          Datos HOY:
          ${JSON.stringify(todayLLMInput, null, 2)}

          Datos ULTIMA SEMANA:
          ${JSON.stringify(yesterdayLLMInput, null, 2)}

          INSTRUCCIONES IMPORTANTES:
          - Analiza patrones, no solo reglas.
          - Si hay incertidumbre, usa OFF.
          - Si hay actividad clara, usa ON.
          - Si hay inactividad sostenida en ambos días, usa OFF.

          RESPUESTA OBLIGATORIA:
          Devuelve SOLO JSON válido:

          {
            "decision": "ON" | "OFF",
            "confidence": number,
            "reason": string
          }

          RESTRICCIONES:
          - confidence entre 0 y 1
          - reason máximo 25 palabras
          - no texto fuera del JSON
          `;

    const URL = "https://zeroemitionsmartpower-backend.onrender.com/chat"
  
      fetch(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      })
      .then(r => r.json())
      .then(res => {
        let parsed;

        try {
          const cleanText = cleanLLMText(res?.text);

          parsed = JSON.parse(cleanText);
        } catch (e) {
          console.error("LLM parse error:", e, res);

          parsed = {
            decision: "ON",
            confidence: 0,
            reason: "Invalid LLM response format"
          };
        }

        resolve({
          decision: parsed?.decision ?? "ON",
          confidence: Number(parsed?.confidence ?? 0),
          reason: parsed?.reason ?? ""
        });
      })
      .catch(() => {
        const fallback = shouldShutdownATMWithYesterday_fallback(todayATM, yesterdayATM);

        resolve({
          decision: fallback ? "OFF" : "ON",
          confidence: 0.5,
          reason: generateLLMExplanation(todayATM)
        });
      });
    });
  }

  function shouldShutdownATMWithYesterday(todayATM, yesterdayATM) {
    const lastHours = todayATM.daily.slice(horaActual-ultimasHorasReferencia) // últimas 3 horas
    const currentHour = todayATM.daily.slice(-1) // últimas 3 horas
    
    // bajo consumo hoy
    const lowConsumption = lastHours.every(h => h.kwh <= 100)
    const isIdleWindow = lastHours.every(h => h.state === "idle")
  
    const yesterdayHours = Array.from(
      { length: ultimasHorasReferencia },
      (_, i) => {
        const index =
          (horaActual - ultimasHorasReferencia + i + yesterdayATM.daily.length) %
          yesterdayATM.daily.length
    
        return yesterdayATM.daily[index]
      }
    )
    
    const wasIdleYesterday = yesterdayHours.every(h => h.state === "idle")
    
    //No se encuentra en hora peak
    const notAtPeak = currentHour.state != "peak"

    console.log('lowConsumption',lowConsumption);
    console.log('isIdleWindow',isIdleWindow);
    console.log('wasIdleYesterday',wasIdleYesterday);
    console.log('notAtPeak',notAtPeak);
    // decisión combinada
    return lowConsumption && isIdleWindow && wasIdleYesterday && notAtPeak
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
            //decision?.action !== "OFF" &&
            hour.state !== "idle"
          ) {
            optimizedKwh += hour.kwh
            optimizedCO2 += hour.co2
          }
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
  initEnergyAsync();

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
            <button id="LLMBtn" class="btn btn-secondary">
                LLM
            </button>
        </div>
    </div>

    <div class="panel-container row g-1">
      <div class="col-12 col-md-6 col-lg-3">
        <div class="card h-100 compact-card">
          <div class="card-header bar-primary">
            <span class="bar-title">Estado</span>
          </div>
          <div class="card-body">
            <div id="shutdownPanel"></div>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-6 col-lg-3">
        <div class="card h-100 compact-card">
          <div class="card-header bar-primary">
            <span class="bar-title">Horarios de actividad</span>
          </div>
          <div class="card-body">
            <div id="atmPanel"></div>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-6 col-lg-3">
        <div class="card h-100 compact-card">
          <div class="card-header bar-primary">
            <span class="bar-title">Consumo energético</span>
          </div>
          <div class="card-body">
            <div id="atmWhPanel"></div>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-6 col-lg-3">
        <div class="card h-100 compact-card">
          <div class="card-header bar-primary">
            <span class="bar-title">Generación de CO2</span>
          </div>
          <div class="card-body">
            <div id="atmCO2Panel"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="row mt-3">
      <div class="card p-3 mb-3">
        <h5>Sucursales</h5>
        <canvas id="branchChart"></canvas>
      </div>

      <div class="card p-3 mb-3">
        <h5>CO2</h5>
        <canvas id="branchChartCO2"></canvas>
      </div>

      <div class="card p-3 mb-3">
        <h5>ATMs</h5>
        <canvas id="atmChart"></canvas>
      </div>
    </div>
  `;
}

async function initEnergyAsync() {
  try {
    // 👇 ESTE ES EL PUNTO CLAVE
    const shutdownMap = (await computeShutdownMap(groups, yesterday)).flat()//await computeShutdownMap(groups, yesterday);

    console.log("shutdownMap:", shutdownMap);
console.log("first item:", shutdownMap?.[0]);
console.log("keys:", Object.keys(shutdownMap?.[0] || {}));

    setTimeout(() => {
      // ================= INIT UI =================
      renderBranchChart(groups);
      renderBranchChartCO2(groups);

      renderShutdownPanel(shutdownMap);
      renderATMPanels(groups);

      const impact = computeCO2Impact(groups, shutdownMap);
      renderCO2Impact(impact);

      startSimulationEngine(({ groups, decisions, impact }) => {
        renderShutdownPanel(decisions);
        renderCO2Impact(impact);
        renderCO2Chart(impact);
        renderBranchChart(groups);
        renderBranchChartCO2(groups);

        const atmImpact = computeATMImpact(groups, decisions);
        renderAllATMCharts(atmImpact);
      });

      // charts iniciales
      groups.forEach(branch => {
        branch.atms.forEach(atm => {
          renderHourChart({
            ...atm,
            branch: branch.name
          });
        });
      });

    }, 0);

  } catch (err) {
    console.error("Error en initEnergyAsync:", err);
  }
}

function renderShutdownPanel(data) {

    const container = document.getElementById("shutdownPanel");

    if (!container) return;

    const normalized = data
      .flat(Infinity)
      .filter(item => item && item.branch && item.atmId);

    normalized.forEach(item => {
        console.log('renderShutdownPanel');
        console.log(item.branch);
        console.log(item.atmId);

        const branchSafe = item.branch.replace(/\s+/g, "_");

        const panelId = `atmShutdownPanel-${branchSafe}-${item.atmId}`;

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
                    <div class="form-check form-switch" style="display:flex; align-items:center; gap:6px;">
                        <input class="form-check-input" type="checkbox" id="switchAtm" checked>
                        <label id="switchLabel" class="form-check-label smallSwitchLabel" for="switchAtm">Auto</label>
                    </div>
                    <div class="form-check form-switch" style="margin-left:1em;display:flex; align-items:center; gap:6px;">
                        <input class="form-check-input" type="checkbox" id="switchPower-${branchSafe}-${item.atmId}">
                        <label id="switchPowerLabel-${branchSafe}-${item.atmId}" class="form-check-label smallSwitchLabel" for="switchPower-${branchSafe}-${item.atmId}">Apagado</label>
                    </div>
                </div>
                <div class="atmExplanation alert alert-primary p-1"></div>
                <div class="atmConfidence"
                    style="font-size:11px; color:#999;">
                </div>
                <div id="atmActivityCharts-${branchSafe}-${item.atmId}" class="hidden-div">
                    <div class="card p-3"
                        style="flex:1; min-width:300px;">
                        Última semana
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

        const indicator =
            panel.querySelector(".statusIndicator");

        indicator.className =
            `statusIndicator indicator ${item.currentActivityState}`;

        panel.querySelector(".atmTitle").textContent =
            `${item.branch} - ${item.atmId}`;

        const action =
            panel.querySelector(".atmAction");

        let actualPowerState = item.currentPowerState;
        item.currentPowerState = item.action === "OFF" ? 0 : 1;

        //Actualizamos estado del ATM
        const group = groups.find(g => g.name === item.branch);
        if (group) {
            const atm = group.atms.find(a => a.id === item.atmId);
            if (atm) {
                atm.powerState = item.currentPowerState;
                atm.automaticMode = item.currentAutomaticMode;
            }
        }

        //Actualizamos estado de switch power
        const switchPower = document.getElementById(`switchPower-${branchSafe}-${item.atmId}`);
        switchPower.checked = item.currentPowerState == 1;
        switchPower.dispatchEvent(new Event('change', { bubbles: true }));    

        panel.querySelector(".atmExplanation").innerHTML =
            `<span style="font-size:0.9em;">
            <i class="fa-solid fa-brain"></i>
          IA : ${item.explanation}</span>`;

        panel.querySelector(".atmConfidence").textContent =
            `confianza: ${Math.round(item.confidence * 100)}%`;
    });

    const switchAtm = document.getElementById('switchAtm');
    const switchLabel = document.getElementById('switchLabel');
    
    switchAtm.addEventListener('change', () => {
        if (switchAtm.checked) {
            switchLabel.textContent = "Auto"; // ON
        } else {
            switchLabel.textContent = "Manual"; // OFF
        }
    });

    
}

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function startSimulationEngine(onUpdate) {
    if (simulationRunning) return;
  
    simulationRunning = true;
  
    simulationLoopPromise = simulationLoop(onUpdate);
  }

  function stopSimulationEngine() {
    simulationRunning = false;
  }


  async function simulationLoop(onUpdate) {
    try {
      while (simulationRunning) {
  
        if (!state.isRunning) {
          await sleep(200);
          continue;
        }
  
        // ================= TIME =================
        horaActual += 1;
  
        if (horaActual > 23) {
          groups = getEnergy();
          horaActual = 0;
        }
  
        updateHoraPanel();
  
        // ================= ATM UPDATE =================
        groups.forEach(branch => {
          branch.atms.forEach(atm => {
  
            updateDailyATM(atm, horaActual);
  
            const yesterdayBranch = yesterday.find(b => b.name === branch.name);
            const yesterdayATM = yesterdayBranch?.atms.find(a => a.id === atm.id);
  
            updateATMChart(branch.name, atm, yesterdayATM);
  
            const stateEl = document.getElementById(
              `state-${branch.name}-${atm.id}`
            );
  
            const shouldOff = shouldShutdownATMWithYesterday(atm, yesterdayATM);
  
            if (stateEl) {
              stateEl.textContent = shouldOff ? "OFF" : "ON";
            }
  
            updateHourChart({
              ...atm,
              branch: branch.name
            });
          });
        });
  
        // ================= AI DECISION LAYER =================
        const decisions = await computeShutdownMap(groups, yesterday);
  
        // ================= IMPACT =================
        const impact = computeCO2Impact(groups, decisions);
  
        updateCO2Chart(impact);
  
        onUpdate({
          groups,
          decisions,
          impact,
          timestamp: new Date()
        });
  
        // ================= CONTROL SPEED =================
        await sleep(milisegundosDuracionHoraSimulada);
      }
  
    } catch (err) {
      console.error("Simulation loop error:", err);
    }
  }












  function sendToRelay(decision) {
    //console.log(`⚡ [SIMULATED RELAY] ${decision.atmId} → ${decision.action}`)
  }

  function generateLLMExplanation(atm) {
    const lastHours = atm.daily.slice(-ultimasHorasReferencia)
  
    const avgConsumption =
      lastHours.reduce((sum, h) => sum + h.kwh, 0) / lastHours.length
  
    const idleHours = lastHours.filter(h => h.state === "idle").length
  
    const hadRecentPeak = atm.daily
      .slice(-ultimasHorasReferencia)
      .some(h => h.state === "peak_operational")
  
    if (idleHours <= ultimasHorasReferencia && avgConsumption <= 100 && !hadRecentPeak && atm.actualPowerState == 1) {
      return "Apagado recomendado: inactividad sostenida y consumo bajo detectado."
    }
  
    if (hadRecentPeak) {
      return "Mantener encendido: actividad reciente en franja peak."
    }
  
    if (avgConsumption > 100) {
      return "Mantener encendido: consumo indica uso activo del ATM."
    }
  
    return "Estado estable: mantener estado actual."//sin condiciones claras para apagado."
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
  
    const newCurrent = impact.branches.map(b => b.currentCO2)
    const newOptimized = impact.branches.map(b => b.optimizedCO2)
  
    co2Chart.data.datasets[0].data = newCurrent
    co2Chart.data.datasets[1].data = newOptimized
  
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
    const isIdle = schedule.idleHours.includes(h)
    const isPeak = schedule.peakOperationHours.includes(h)
    const isOperating = schedule.operationHours.includes(h)
  
    let state, kwh

    if (isIdle) {
      state = "idle"
      kwh = Math.floor(Math.random() * (99 - 90 + 1)) + 90
    } 
    else if (isPeak) {
      state = "peak_operational"
      kwh = Math.floor(Math.random() * (800 - 700 + 1)) + 700
    } 
    else if (isOperating) {
      state = "operational"
      kwh = Math.floor(Math.random() * (500 - 300 + 1)) + 300
    }
  
    const co2 = kwh * factorEmisionxKWhDiario
    const powerState = 0;
  
    return { hour: `${h}:00`, state, kwh, co2, powerState }
  }

  function updateDailyATM(atm, horaActual) {
    // generar solo la hora actual
    const newHourData = generateHourData(atm.schedule, horaActual)
    newHourData.powerState = atm.powerState; //Agregamos el estado del ATM al momento de generar la hora
  
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
    const panelWh = document.getElementById("atmWhPanel")
    const panelCO2 = document.getElementById("atmCO2Panel")
    panel.innerHTML = "" 
    panel.panelWh = "" 
    panel.panelCO2 = "" 
  
    groups.forEach(branch => {
      branch.atms.forEach(atm => {
        const atmDiv = document.createElement("div")
        atmDiv.className = "atm-item"
        atmDiv.id = `atm-${branch.name}-${atm.id}`

        const atmWhDiv = document.createElement("div")
        atmWhDiv.className = "atm-item"
        atmWhDiv.id = `atm-${branch.name}-${atm.id}`

        const atmCO2Div = document.createElement("div")
        atmCO2Div.className = "atm-item"
        atmCO2Div.id = `atm-${branch.name}-${atm.id}`
  
        atmDiv.innerHTML = `
            <strong>${branch.name} - ${atm.id}</strong> <span id="state-${branch.name}-${atm.id}">ON</span>
            <div style="display:flex;
                flex-direction:row;
                gap:12px;
                align-items:center;
                flex-wrap:wrap;">
                <canvas id="chart-${branch.name}-${atm.id}" width="200" height="100"></canvas>
            </div>
            `

        atmWhDiv.innerHTML = `
            <strong>${branch.name} - ${atm.id}</strong>
            <div style="display:flex;
                flex-direction:row;
                gap:12px;
                align-items:center;
                flex-wrap:wrap;">
                <canvas 
                    id="kwh-${branch.name}-${atm.id}" 
                    width="220" 
                    height="120">
                </canvas>
            </div>
            `

          atmCO2Div.innerHTML = `
          <strong>${branch.name} - ${atm.id}</strong>
            <div style="display:flex;
                flex-direction:row;
                gap:12px;
                align-items:center;
                flex-wrap:wrap;">
                <canvas 
                    id="co2-${branch.name}-${atm.id}" 
                    width="220" 
                    height="120">
                </canvas>
            </div>
            `
          panel.appendChild(atmDiv)
          panelWh.appendChild(atmWhDiv)
          panelCO2.appendChild(atmCO2Div)
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
            { label: "Últ. Semana", data: yesterdayDataKwh, borderColor: "gray", fill: false, borderDash: [5,5] }
          ]
        },
        options: {
          responsive: false,
          scales: { y: { beginAtZero: true } }
        },
        plugins: {
            title: {
                display: true,
                text: 'Consumo (Wh)',
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
        labels: ["Normal", "Optimizado"],
  
        datasets: [{
          label: "wh",
  
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
                text: 'Consumo (Wh)',
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
        labels: ["Normal", "Optimizado"],
  
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
                text: 'CO₂ generado (grs)',
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
                y: { stacked: true, title: { display: true, text: "wh" } }
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
                y: { stacked: true, title: { display: true, text: "wh" } }
            }
        }
    });
}

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