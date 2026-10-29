# SGIB – Sistema de Gestión de Inventario y Bodega (versión beta 0.9)

Versión beta desarrollada con la metodología **RUP** para una empresa de compra y venta de mercancías. Controla la **entrada** de mercancía (pedidos despachados por proveedores) y la **salida** (ventas facturadas al cliente), con kárdex y alertas de stock mínimo.

## Funcionalidades

| Módulo | Qué hace |
| --- | --- |
| Inventario | Stock por categoría, búsqueda, valor del inventario al costo y alertas de reposición |
| Pedidos de compra | Crear pedidos a proveedores y registrar el despacho con su remisión |
| Recepción (entrada) | Recibir un pedido despachado, total o parcial, con validación por línea |
| Punto de venta (salida) | Venta con factura (subtotal, IVA 19 %, total) y descuento de stock |
| Kárdex | Historial de entradas y salidas con documento, saldo y usuario |
| Pruebas | Ejecuta los 9 caminos básicos de `registrarSalida` (V(G) = 9) |

## Estructura

```
sgib-bodega-beta/
├── index.html        # Interfaz de la beta (HTML + CSS + JS, sin dependencias)
├── inventario.js     # Lógica de negocio: clase Bodega (entrada, salida, kárdex)
├── pruebas.test.js   # Pruebas del camino básico y de entrada (Node.js)
├── package.json
├── .nojekyll
└── README.md
```

## Uso local

Abre `index.html` en el navegador (doble clic). No necesita servidor ni instalación.

## Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub, por ejemplo `sgib-bodega-beta`.
2. Sube todos los archivos de esta carpeta a la raíz del repositorio:
   ```bash
   git init
   git add .
   git commit -m "SGIB versión beta 0.9"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/sgib-bodega-beta.git
   git push -u origin main
   ```
3. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)` y **Save**.
4. En uno o dos minutos la beta queda en `https://TU-USUARIO.github.io/sgib-bodega-beta/`.

## Ejecutar las pruebas

Requiere Node.js 16 o superior:

```bash
npm test
```

Resultado esperado: `10/10 pruebas pasaron` (9 caminos básicos de la salida + 1 prueba funcional de la entrada).

## Notas de la beta

- Los datos de ejemplo se guardan en el navegador de cada usuario (`localStorage`). El botón **Restablecer datos de ejemplo** vuelve al estado inicial.
- Moneda en pesos colombianos (COP), IVA 19 % y costo por promedio ponderado.
- La versión de producción reemplaza `localStorage` por una API con base de datos (PostgreSQL), inicio de sesión por roles y facturación electrónica.
