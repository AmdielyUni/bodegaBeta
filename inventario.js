/**
 * SGIB - Sistema de Gestión de Inventario y Bodega
 * Módulo de lógica de negocio: entrada (recepción de pedidos) y salida (ventas facturadas).
 * Independiente de la interfaz (RNF-13): funciona en el navegador y en Node.js.
 */
(function (global) {
  'use strict';

  const IVA = 0.19;

  class Bodega {
    constructor(datos) {
      const d = datos || {};
      this.categorias = d.categorias || [];
      this.productos = d.productos || [];
      this.proveedores = d.proveedores || [];
      this.pedidos = d.pedidos || [];
      this.facturas = d.facturas || [];
      this.movimientos = d.movimientos || [];
      this.consecutivos = d.consecutivos || { pedido: 1, factura: 1, movimiento: 1 };
    }

    // ---------- Consultas ----------
    buscarProducto(codigo) {
      return this.productos.find(p => p.codigo === codigo) || null;
    }
    buscarPedido(numero) {
      return this.pedidos.find(p => p.numero === numero) || null;
    }
    productosPorCategoria(categoriaId) {
      return this.productos.filter(p => p.categoriaId === categoriaId);
    }
    kardex(codigo) {
      return this.movimientos.filter(m => m.codigo === codigo);
    }

    // ---------- Movimientos ----------
    registrarMovimiento(tipo, producto, cantidad, documento, usuario) {
      const mov = {
        id: this.consecutivos.movimiento++,
        fecha: new Date().toISOString(),
        tipo,                       // 'ENTRADA' | 'SALIDA'
        codigo: producto.codigo,
        cantidad,
        documento,                  // p. ej. 'PC-0001' o 'FV-0001'
        saldo: producto.stock,
        usuario: usuario || 'sistema'
      };
      this.movimientos.push(mov);
      return mov;
    }

    // ---------- Pedidos de compra (RF-04, RF-05) ----------
    crearPedido(proveedorNit, lineas) {
      if (!this.proveedores.some(p => p.nit === proveedorNit)) {
        return { ok: false, error: 'El proveedor no existe' };
      }
      if (!lineas || lineas.length === 0) {
        return { ok: false, error: 'El pedido no tiene artículos' };
      }
      for (const l of lineas) {
        if (!this.buscarProducto(l.codigo)) return { ok: false, error: `Producto ${l.codigo} no existe` };
        if (!(l.cantidad > 0) || !(l.costoUnitario > 0)) return { ok: false, error: `Cantidad o costo inválido en ${l.codigo}` };
      }
      const pedido = {
        numero: 'PC-' + String(this.consecutivos.pedido++).padStart(4, '0'),
        proveedorNit,
        fecha: new Date().toISOString(),
        estado: 'PENDIENTE',
        remision: null,
        items: lineas.map(l => ({ codigo: l.codigo, cantidadPedida: l.cantidad, cantidadRecibida: 0, costoUnitario: l.costoUnitario }))
      };
      this.pedidos.push(pedido);
      return { ok: true, pedido };
    }

    registrarDespacho(numero, remision) {
      const pedido = this.buscarPedido(numero);
      if (!pedido) return { ok: false, error: 'El pedido no existe' };
      if (pedido.estado !== 'PENDIENTE') return { ok: false, error: 'Solo se despachan pedidos pendientes' };
      pedido.estado = 'DESPACHADO';
      pedido.remision = remision || null;
      return { ok: true, pedido };
    }

    // ---------- ENTRADA de mercancía (RF-06 a RF-09) ----------
    registrarEntrada(numeroPedido, recepcion, usuario) {
      const pedido = this.buscarPedido(numeroPedido);
      if (!pedido) {
        return { ok: false, error: 'El pedido no existe' };
      }
      if (pedido.estado !== 'DESPACHADO' && pedido.estado !== 'RECIBIDO_PARCIAL') {
        return { ok: false, error: 'El pedido no ha sido despachado por el proveedor o ya fue recibido' };
      }
      if (!recepcion || recepcion.length === 0) {
        return { ok: false, error: 'No hay cantidades recibidas' };
      }
      const errores = [];
      for (const linea of recepcion) {
        const item = pedido.items.find(i => i.codigo === linea.codigo);
        const pendiente = item ? item.cantidadPedida - item.cantidadRecibida : 0;
        if (!item) {
          errores.push(`El producto ${linea.codigo} no está en el pedido`);
        } else if (!(linea.cantidad > 0)) {
          errores.push(`Cantidad inválida para ${linea.codigo}`);
        } else if (linea.cantidad > pendiente) {
          errores.push(`Se reciben ${linea.cantidad} de ${linea.codigo} pero solo hay ${pendiente} pendientes`);
        }
      }
      if (errores.length > 0) {
        return { ok: false, error: errores.join('; ') };
      }
      const movimientos = [];
      for (const linea of recepcion) {
        const item = pedido.items.find(i => i.codigo === linea.codigo);
        const producto = this.buscarProducto(linea.codigo);
        // Costo promedio ponderado
        const valorAnterior = producto.stock * producto.costo;
        const valorEntrada = linea.cantidad * item.costoUnitario;
        producto.stock += linea.cantidad;
        producto.costo = Math.round((valorAnterior + valorEntrada) / producto.stock);
        item.cantidadRecibida += linea.cantidad;
        movimientos.push(this.registrarMovimiento('ENTRADA', producto, linea.cantidad, pedido.numero, usuario));
      }
      const completo = pedido.items.every(i => i.cantidadRecibida === i.cantidadPedida);
      pedido.estado = completo ? 'RECIBIDO' : 'RECIBIDO_PARCIAL';
      return { ok: true, pedido, movimientos };
    }

    // ---------- SALIDA de mercancía (RF-10 a RF-14) ----------
    registrarSalida(venta, usuario) {
      const items = (venta && venta.items) || [];
      if (items.length === 0) {                                         // P1
        return { ok: false, error: 'La venta no tiene artículos' };      // N2
      }
      const errores = [];
      for (const item of items) {                                       // P2
        const producto = this.buscarProducto(item.codigo);
        if (!producto) {                                                // P3
          errores.push(`El producto ${item.codigo} no existe`);         // N5
        } else if (!(item.cantidad > 0)) {                              // P4
          errores.push(`Cantidad inválida para ${item.codigo}`);        // N7
        } else if (item.cantidad > producto.stock) {                    // P5
          errores.push(`Stock insuficiente de ${item.codigo}: hay ${producto.stock}`); // N9
        }
      }
      if (errores.length > 0) {                                         // P6
        return { ok: false, error: errores.join('; ') };                // N12
      }
      const factura = this.crearFactura(venta);
      const alertas = [];
      for (const item of items) {                                       // P7
        const producto = this.buscarProducto(item.codigo);
        producto.stock -= item.cantidad;
        this.registrarMovimiento('SALIDA', producto, item.cantidad, factura.numero, usuario);
        if (producto.stock <= producto.stockMinimo) {                   // P8
          alertas.push(`Reponer ${producto.nombre}: quedan ${producto.stock} (mínimo ${producto.stockMinimo})`); // N15
        }
      }
      return { ok: true, factura, alertas };                            // N17
    }

    crearFactura(venta) {
      const lineas = venta.items.map(item => {
        const p = this.buscarProducto(item.codigo);
        return { codigo: p.codigo, nombre: p.nombre, cantidad: item.cantidad, precioUnitario: p.precioVenta, total: item.cantidad * p.precioVenta };
      });
      const subtotal = lineas.reduce((s, l) => s + l.total, 0);
      const iva = Math.round(subtotal * IVA);
      const factura = {
        numero: 'FV-' + String(this.consecutivos.factura++).padStart(4, '0'),
        fecha: new Date().toISOString(),
        cliente: venta.cliente || { documento: '222222222222', nombre: 'Consumidor final' },
        lineas, subtotal, iva, total: subtotal + iva
      };
      this.facturas.push(factura);
      return factura;
    }

    alertasStock() {
      return this.productos.filter(p => p.stock <= p.stockMinimo);
    }
  }

  const api = { Bodega, IVA };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.SGIB = api;
})(typeof window !== 'undefined' ? window : globalThis);
