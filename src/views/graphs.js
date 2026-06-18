let branchChart = null;
let branchChartCO2 = null;
let atmChart = null;

export function renderBranchChart(data) {
    const ctx = document.getElementById('branchChart');
    if (!ctx) return;
  
    const branchData = data.map(branch => ({
      name: branch.name,
      total: branch.atms.reduce((sum, atm) => sum + atm.consumption, 0)
    }));
  
    if (branchChart) branchChart.destroy();
  
    branchChart = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: branchData.map(b => b.name),
        datasets: [{
          label: 'Consumo total (Wh)',
          data: branchData.map(b => b.total),
          backgroundColor: '#4f46e5'
        }]
      }
    });
  }

  export function renderBranchChartCO2(data, metaReduccionCO2) {
    const ctx = document.getElementById('branchChartCO2');
    if (!ctx) return;
  
    const branchData = data.map(branch => ({
      name: branch.name,
      co2: branch.atms.reduce((sum, atm) => sum + atm.co2, 0)
    }));
  
    if (branchChartCO2) branchChartCO2.destroy();
  
    branchChartCO2 = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: branchData.map(b => b.name),
        datasets: [{
          label: 'CO2 Generado',
          data: branchData.map(c => c.co2),
          backgroundColor: '#f59e0b'
        }]
      }
    });
  }

  export function renderAtmChart(branch) {
    const ctx = document.getElementById('atmChart');
    if (!ctx) return;
  
    if (atmChart) atmChart.destroy();
  
    document.getElementById('atmTitle').innerText =
      `ATMs - ${branch.name}`;
  
    const labels = branch.atms.map(atm => atm.id);
  
    const idleData = branch.atms.map(atm =>
      atm.daily.filter(d => d.state === "idle")
        .reduce((s, d) => s + d.kwh, 0)
    );
  
    const operationalData = branch.atms.map(atm =>
      atm.daily.filter(d => d.state === "operational")
        .reduce((s, d) => s + d.kwh, 0)
    );
  
    const peakData = branch.atms.map(atm =>
      atm.daily.filter(d => d.state === "peak_operational")
        .reduce((s, d) => s + d.kwh, 0)
    );
  
    atmChart = new window.Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Idle", data: idleData, backgroundColor: "#f59e0b" },
          { label: "Operativo", data: operationalData, backgroundColor: "#22c55e" },
          { label: "Peak", data: peakData, backgroundColor: "#f00000" }
        ]
      },
      options: {
        responsive: true,
        scales: {
          x: { stacked: true },
          y: { stacked: true }
        }
      }
    });
  }