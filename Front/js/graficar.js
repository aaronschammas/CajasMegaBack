document.getElementById('formGraficos').addEventListener('submit', async function(e) {
        e.preventDefault();
        const desde = document.getElementById('fecha_Desde').value;
        const hasta = document.getElementById('fecha_hasta').value;
        const tipo = document.getElementById('tipo').value;
        const turno = document.getElementById('turno').value;
        const arco_id = document.getElementById('arco_id').value;
        const montoMinimo = document.getElementById('monto_Minimo').value;
        const montoMaximo = document.getElementById('monto_Maximo').value;
        const balanceNegativo = document.getElementById('balance_negativo').checked;
        let url = `/api/graficos?fecha_Desde=${desde}&fecha_hasta=${hasta}&tipo=${tipo}`;
        if (turno) url += `&turno=${turno}`;
        if (arco_id) url += `&arco_id=${arco_id}`;
        if (montoMinimo) url += `&monto_Minimo=${montoMinimo}`;
        if (montoMaximo) url += `&monto_Maximo=${montoMaximo}`;
        if (balanceNegativo) url += `&balance_negativo=1`;
        const res = await fetch(url);
        if (!res.ok) {
            document.getElementById('tablaContainer').innerHTML = '<p style="color:red">Error al obtener datos</p>';
            return;
        }
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
            document.getElementById('tablaContainer').innerHTML = '<p>No hay datos para mostrar</p>';
            document.getElementById('conclusionesContainer').innerHTML = '';
            return;
        }
        // Generar tabla tipo Excel básica
        let html = '<table><thead><tr>';
        const cols = Object.keys(data[0]);
        for (const col of cols) html += `<th>${col}</th>`;
        html += '</tr></thead><tbody>';
        let total = 0;
        let negativos = 0;
        for (const row of data) {
            html += '<tr>';
            for (const col of cols) html += `<td>${row[col]}</td>`;
            html += '</tr>';
            if (row["Monto"] !== undefined) total += Number(row["Monto"]);
            if (row["Balance"] !== undefined && row["Balance"] < 0) negativos++;
        }
        html += '</tbody></table>';
        document.getElementById('tablaContainer').innerHTML = html;
        // Mostrar conclusiones
        let conclusiones = `<p><strong>Balance total:</strong> $${total.toFixed(2)}</p>`;
        if (negativos > 0) conclusiones += `<p><strong>Arcos con balance negativo:</strong> ${negativos}</p>`;
        document.getElementById('conclusionesContainer').innerHTML = conclusiones;
    });

// --- Botón para crear gráfico dinámico ---
document.getElementById('btnCrearGrafico').addEventListener('click', function() {
    // Obtener los datos de la tabla
    const tabla = document.querySelector('#tablaContainer table');
    if (!tabla) {
        document.getElementById('graficoContainer').innerHTML = '<p>No hay datos para graficar</p>';
        return;
    }
    // Preguntar al usuario el tipo de gráfico y criterio
    const tipoGrafico = prompt('Tipo de gráfico: "barras" o "torta"', 'barras');
    const criterio = prompt('Agrupar por: "Mes", "Concepto", "Turno"', 'Mes');
    // Parsear datos
    const rows = Array.from(tabla.querySelectorAll('tbody tr'));
    const headers = Array.from(tabla.querySelectorAll('thead th')).map(th => th.textContent);
    let agrupado = {};
    rows.forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('td'));
        const obj = {};
        cells.forEach((td, i) => obj[headers[i]] = td.textContent);
        let key = '';
        if (criterio.toLowerCase() === 'mes') {
            key = obj['Fecha'] ? obj['Fecha'].slice(0,7) : '';
        } else if (criterio.toLowerCase() === 'concepto') {
            key = obj['Concepto'] || '';
        } else if (criterio.toLowerCase() === 'turno') {
            key = obj['Turno'] || '';
        }
        if (!agrupado[key]) agrupado[key] = 0;
        agrupado[key] += Number(obj['Monto']) || 0;
    });
    // Preparar datos para Chart.js
    const labels = Object.keys(agrupado);
    const values = Object.values(agrupado);
    // Limpiar contenedor
    document.getElementById('graficoContainer').innerHTML = '<canvas id="graficoCanvas"></canvas>';
    const ctx = document.getElementById('graficoCanvas').getContext('2d');
    // Crear gráfico
    new Chart(ctx, {
        type: tipoGrafico === 'torta' ? 'pie' : 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Monto',
                data: values,
                backgroundColor: tipoGrafico === 'torta' ? [
                    '#5dade2','#58d68d','#f7dc6f','#e59866','#af7ac5','#f1948a','#45b39d','#dc7633'
                ] : '#5dade2',
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: tipoGrafico === 'torta' },
                title: { display: true, text: `Gráfico por ${criterio}` }
            }
        }
    });
});
