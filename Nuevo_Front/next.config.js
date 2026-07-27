/** @type {import('next').NextConfig} */

const BACKEND = process.env.BACKEND_URL || 'http://localhost:8080'

const nextConfig = {
  async rewrites() {
    return [
      // ── Auth ──────────────────────────────────────────────────────────────
      { source: '/api/login',           destination: `${BACKEND}/api/login` },
      { source: '/api/register',        destination: `${BACKEND}/api/register` },
      { source: '/api/me',              destination: `${BACKEND}/api/me` },
      { source: '/api/change-password', destination: `${BACKEND}/api/change-password` },
      { source: '/logout',              destination: `${BACKEND}/logout` },

      // ── Arco ──────────────────────────────────────────────────────────────
      { source: '/arco/abrir',          destination: `${BACKEND}/arco/abrir` },
      { source: '/arco/abrir-avanzado', destination: `${BACKEND}/arco/abrir-avanzado` },
      { source: '/arco/cerrar',         destination: `${BACKEND}/arco/cerrar` },
      { source: '/arco/estado',         destination: `${BACKEND}/arco/estado` },

      // ── Saldo y estado (API JSON) ─────────────────────────────────────────
      { source: '/api/arco-estado',          destination: `${BACKEND}/api/arco-estado` },
      { source: '/api/saldo-ultimo-arco',    destination: `${BACKEND}/api/saldo-ultimo-arco` },

      // ── Movimientos ───────────────────────────────────────────────────────
      // IMPORTANTE: no existe POST /egresos — ambos tipos van a POST /ingresos
      // Ruta proxy exclusiva: evita interceptar GET /ingresos (pantalla React).
      { source: '/api/movimientos/batch',              destination: `${BACKEND}/ingresos` },
      { source: '/api/movimientos/arco/:arco_id',      destination: `${BACKEND}/api/movimientos/arco/:arco_id` },
      { source: '/api/movimientos/global',             destination: `${BACKEND}/api/movimientos/global` },
      { source: '/api/movimientos/:movement_id',       destination: `${BACKEND}/api/movimientos/:movement_id` },

      // ── Admin (rutas reales del backend) ─────────────────────────────────
      { source: '/api/admin/conceptos',      destination: `${BACKEND}/api/admin/conceptos` },
      { source: '/api/admin/conceptos/:id',  destination: `${BACKEND}/api/admin/conceptos/:id` },
      { source: '/api/admin/usuarios',       destination: `${BACKEND}/api/admin/usuarios` },
      { source: '/api/admin/usuarios/:id',   destination: `${BACKEND}/api/admin/usuarios/:id` },
      { source: '/api/admin/usuarios/:id/reset-password', destination: `${BACKEND}/api/admin/usuarios/:id/reset-password` },
      { source: '/api/admin/roles',          destination: `${BACKEND}/api/admin/roles` },
      { source: '/api/admin/roles/:id',      destination: `${BACKEND}/api/admin/roles/:id` },

      // ── Alquileres ────────────────────────────────────────────────────────
      { source: '/api/alquileres/:path*',    destination: `${BACKEND}/api/alquileres/:path*` },

      // ── Health check ─────────────────────────────────────────────────────
      { source: '/health',                   destination: `${BACKEND}/health` },
    ]
  },
}

module.exports = nextConfig
