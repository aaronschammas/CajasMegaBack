'use client'

// ─── Hook: Arco (estado del turno de caja) ───────────────────────────────────

import { useCallback } from 'react'
import { useAppStore } from '@/lib/store/appStore'
import { getArcoEstado, getSaldoArco, abrirArco, cerrarArco, ArcoConflictError } from '@/lib/api/arco'

export { ArcoConflictError }   // re-exportar para uso en componentes

export function useArco() {
  const {
    arco, arcoAbierto,
    saldoActual, saldoInicial, totalIngresos, totalEgresos, totalRetiros,
    tipoCaja, setArco, setSaldo,
  } = useAppStore()

  const isGlobal = tipoCaja === 'global'

  // Recarga estado + saldo desde el backend
  const recargar = useCallback(async () => {
    try {
      const [estadoData, saldoData] = await Promise.allSettled([
        getArcoEstado(isGlobal),
        getSaldoArco(isGlobal),
      ])

      if (estadoData.status === 'fulfilled') {
        setArco(estadoData.value.arco ?? null, estadoData.value.arco_abierto)
      }
      if (saldoData.status === 'fulfilled') {
        setSaldo(saldoData.value)
      }
    } catch (err) {
      console.error('[useArco] Error recargando:', err)
    }
  }, [isGlobal, setArco, setSaldo])

  // Abre el arqueo. Puede lanzar ArcoConflictError si ya hay uno abierto.
  const abrir = useCallback(
    async (turno: 'M' | 'T', forzarNuevo = false) => {
      const data = await abrirArco(turno, forzarNuevo, isGlobal)
      await recargar()
      return data
    },
    [recargar]
  )

  // Cierra el arqueo actual
  const cerrar = useCallback(
    async (totalContado: number, retiroAmount: number) => {
      if (!arco?.id) throw new Error('No hay arqueo abierto')
      const result = await cerrarArco({
        arcoId: arco.id,
        totalContado,
        retiroAmount,
        isGlobal,
      })
      await recargar()
      return result
    },
    [arco, isGlobal, recargar]
  )

  return {
    arco, arcoAbierto,
    saldoActual, saldoInicial, totalIngresos, totalEgresos, totalRetiros,
    recargar, abrir, cerrar,
  }
}
