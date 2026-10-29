/**
 * Pruebas del camino básico para Bodega.registrarSalida  (V(G) = 9)
 * y pruebas funcionales de Bodega.registrarEntrada.
 * Ejecutar: node pruebas.test.js
 */
const assert = require('assert');
const { Bodega } = require('./inventario.js');

function datosSemilla() {
  return {
    categorias: [{ id: 'ABA', nombre: 'Abarrotes' }, { id: 'ASE', nombre: 'Aseo' }],
    proveedores: [{ nit: '900123456-1', nombre: 'Distribuidora Andina S.A.S.' }],
    productos: [
      { codigo: 'A001', nombre: 'Arroz 500 g', categoriaId: 'ABA', ubicacion: 'E1-N2', costo: 2500, precioVenta: 3200, stock: 50, stockMinimo: 10 },
      { codigo: 'A002', nombre: 'Aceite 1 L', categoriaId: 'ABA', ubicacion: 'E1-N3', costo: 9000, precioVenta: 11500, stock: 12, stockMinimo: 10 },
      { codigo: 'L001', nombre: 'Detergente 1 kg', categoriaId: 'ASE', ubicacion: 'E3-N1', costo: 7000, precioVenta: 9800, stock: 30, stockMinimo: 5 }
    ]
  };
}

const casos = [
  { id: 'C1', camino: '1-2-18', desc: 'Venta sin artículos',
    venta: { items: [] }, ok: false, contiene: ['no tiene artículos'] },
  { id: 'C2', camino: '1-3-4-5-10-3-11-12-18', desc: 'Producto inexistente',
    venta: { items: [{ codigo: 'X999', cantidad: 1 }] }, ok: false, contiene: ['X999 no existe'] },
  { id: 'C3', camino: '1-3-4-6-7-10-3-11-12-18', desc: 'Cantidad cero',
    venta: { items: [{ codigo: 'A001', cantidad: 0 }] }, ok: false, contiene: ['Cantidad inválida'] },
  { id: 'C4', camino: '1-3-4-6-8-9-10-3-11-12-18', desc: 'Stock insuficiente',
    venta: { items: [{ codigo: 'L001', cantidad: 31 }] }, ok: false, contiene: ['Stock insuficiente'] },
  { id: 'C5', camino: '1-3-4-6-8-10-3-11-13-14-16-13-17-18', desc: 'Venta válida sin alerta',
    venta: { items: [{ codigo: 'A001', cantidad: 5 }] }, ok: true, alertas: 0, stock: { A001: 45 } },
  { id: 'C6', camino: '1-3-4-6-8-10-3-11-13-14-15-16-13-17-18', desc: 'Venta válida con alerta de stock mínimo',
    venta: { items: [{ codigo: 'A002', cantidad: 3 }] }, ok: true, alertas: 1, stock: { A002: 9 } },
  { id: 'C7', camino: '1-3-4-6-8-10-3-4-5-10-3-11-12-18', desc: 'Dos artículos: válido + inexistente (no se descuenta nada)',
    venta: { items: [{ codigo: 'A001', cantidad: 2 }, { codigo: 'X999', cantidad: 1 }] }, ok: false, contiene: ['X999 no existe'], stock: { A001: 50 } },
  { id: 'C8', camino: '1-3-4-6-7-10-3-4-6-8-9-10-3-11-12-18', desc: 'Dos artículos: cantidad cero + stock insuficiente',
    venta: { items: [{ codigo: 'A001', cantidad: 0 }, { codigo: 'A002', cantidad: 20 }] }, ok: false, contiene: ['Cantidad inválida', 'Stock insuficiente'] },
  { id: 'C9', camino: '1-3-4-6-8-10-3-4-6-8-10-3-11-13-14-15-16-13-14-16-13-17-18', desc: 'Dos artículos válidos: el primero queda en mínimo, el segundo no',
    venta: { items: [{ codigo: 'A002', cantidad: 2 }, { codigo: 'L001', cantidad: 1 }] }, ok: true, alertas: 1, stock: { A002: 10, L001: 29 } }
];

let pasaron = 0;
for (const c of casos) {
  const b = new Bodega(datosSemilla());
  const r = b.registrarSalida(c.venta, 'tester');
  try {
    assert.strictEqual(r.ok, c.ok, 'resultado ok');
    (c.contiene || []).forEach(t => assert.ok(r.error.includes(t), `mensaje debe contener "${t}"`));
    if (c.alertas !== undefined) assert.strictEqual(r.alertas.length, c.alertas, 'número de alertas');
    Object.entries(c.stock || {}).forEach(([cod, s]) => assert.strictEqual(b.buscarProducto(cod).stock, s, `stock ${cod}`));
    if (!c.ok) assert.strictEqual(b.movimientos.length, 0, 'no debe haber movimientos');
    if (c.ok) assert.strictEqual(b.movimientos.filter(m => m.tipo === 'SALIDA').length, c.venta.items.length, 'movimientos de salida');
    pasaron++;
    console.log(`PASA  ${c.id} ${c.desc}`);
  } catch (e) {
    console.log(`FALLA ${c.id} ${c.desc}: ${e.message}`);
  }
}

// ---- Pruebas funcionales de ENTRADA ----
(function () {
  const b = new Bodega(datosSemilla());
  const p = b.crearPedido('900123456-1', [{ codigo: 'A001', cantidad: 20, costoUnitario: 2800 }, { codigo: 'L001', cantidad: 10, costoUnitario: 7300 }]).pedido;
  assert.strictEqual(b.registrarEntrada(p.numero, [{ codigo: 'A001', cantidad: 5 }]).ok, false, 'no se recibe un pedido pendiente');
  b.registrarDespacho(p.numero, 'REM-778');
  assert.ok(b.registrarEntrada(p.numero, [{ codigo: 'A001', cantidad: 25 }]).error.includes('pendientes'), 'no se recibe más de lo pedido');
  let r = b.registrarEntrada(p.numero, [{ codigo: 'A001', cantidad: 20 }]);
  assert.ok(r.ok);
  assert.strictEqual(p.estado, 'RECIBIDO_PARCIAL');
  assert.strictEqual(b.buscarProducto('A001').stock, 70);
  assert.strictEqual(b.buscarProducto('A001').costo, Math.round((50 * 2500 + 20 * 2800) / 70));
  r = b.registrarEntrada(p.numero, [{ codigo: 'L001', cantidad: 10 }]);
  assert.ok(r.ok);
  assert.strictEqual(p.estado, 'RECIBIDO');
  assert.strictEqual(b.kardex('A001').at(-1).saldo, 70);
  console.log('PASA  Entrada: pedido pendiente rechazado, exceso rechazado, parcial y completo con costo promedio');
  pasaron++;
})();

console.log(`\n${pasaron}/${casos.length + 1} pruebas pasaron`);
process.exitCode = pasaron === casos.length + 1 ? 0 : 1;
