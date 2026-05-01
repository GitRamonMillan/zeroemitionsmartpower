import { getEnergy, updateEnergy } from '../services/energy.js'

export async function renderEnergy() {
  const data = await getEnergy()

  setTimeout(() => {
    document.querySelector('#saveEnergy').onclick = async () => {
      const inputs = document.querySelectorAll('.energy-input')

      const values = Array.from(inputs).map(i => Number(i.value))

      await updateEnergy(values)

      alert('Energía actualizada ⚡')
    }
  }, 0)

  return `
    <h2>Consumo de energía ⚡</h2>

    <div class="card p-3 mt-3">
      ${data.map((v, i) => `
        <div class="mb-2 d-flex gap-2 align-items-center">
          <label>Día ${i + 1}</label>
          <input type="number"
                 class="form-control energy-input"
                 value="${v}"
                 style="max-width:120px;">
        </div>
      `).join('')}
    </div>

    <button class="btn btn-primary mt-3" id="saveEnergy">
      Guardar cambios
    </button>
  `
}