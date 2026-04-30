export function renderUsers() {
    return `
      <h2>Usuarios</h2>
  
      <table class="table mt-3">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Admin</td>
            <td class="text-success">Activo</td>
          </tr>
          <tr>
            <td>Usuario 2</td>
            <td class="text-muted">Inactivo</td>
          </tr>
        </tbody>
      </table>
    `
  }