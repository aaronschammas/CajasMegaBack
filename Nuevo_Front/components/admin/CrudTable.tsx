'use client'

// ─── CrudTable: Tabla genérica con búsqueda para módulos de admin ─────────────
// Usada por conceptos, usuarios y roles.

import { useState, useMemo, ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: string
  render: (item: T) => ReactNode
  searchable?: boolean   // si este campo se incluye en la búsqueda de texto
}

interface Props<T> {
  items: T[]
  columns: Column<T>[]
  keyField: keyof T
  onNew: () => void
  newLabel?: string
  loading?: boolean
  emptyText?: string
  searchPlaceholder?: string
  getSearchText?: (item: T) => string   // función para extraer texto searchable
}

export function CrudTable<T>({
  items, columns, keyField,
  onNew, newLabel = '+ Nuevo',
  loading = false,
  emptyText = 'No hay registros',
  searchPlaceholder = 'Buscar…',
  getSearchText,
}: Props<T>) {
  const [busqueda, setBusqueda] = useState('')

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return items
    const q = busqueda.toLowerCase()
    return items.filter((item) => {
      if (getSearchText) return getSearchText(item).toLowerCase().includes(q)
      // Fallback: busca en todos los valores string del objeto
      return Object.values(item as object)
        .some((v) => typeof v === 'string' && v.toLowerCase().includes(q))
    })
  }, [items, busqueda, getSearchText])

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-300 focus:outline-none"
          />
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          {newLabel}
        </button>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {columns.map((col) => (
                <th key={col.key} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                    <p>Cargando…</p>
                  </div>
                </td>
              </tr>
            ) : filtrados.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <p className="text-4xl">📭</p>
                    <p>{busqueda ? 'Sin resultados para esta búsqueda' : emptyText}</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtrados.map((item) => (
                <tr key={String(item[keyField])} className="hover:bg-gray-50 transition-colors">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      {!loading && (
        <div className="px-4 py-2 border-t border-gray-50 text-xs text-gray-400">
          {filtrados.length} de {items.length} registro{items.length !== 1 ? 's' : ''}
          {busqueda && ` (filtrado)`}
        </div>
      )}
    </div>
  )
}
