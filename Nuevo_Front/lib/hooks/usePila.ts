'use client'

// ─── Hook: Pila de movimientos ────────────────────────────────────────────────
// Array en memoria de movimientos pendientes de enviar a la DB.
// Equivale al array pilaMovimientos de ingresos.js / egresos.js.

import { useReducer } from 'react'
import { MovimientoPendiente } from '@/types/movimiento'

type PilaAction =
  | { type: 'ADD'; movimiento: MovimientoPendiente }
  | { type: 'REMOVE'; index: number }
  | { type: 'CLEAR' }

function pilaReducer(
  state: MovimientoPendiente[],
  action: PilaAction
): MovimientoPendiente[] {
  switch (action.type) {
    case 'ADD':
      return [...state, action.movimiento]
    case 'REMOVE':
      return state.filter((_, i) => i !== action.index)
    case 'CLEAR':
      return []
    default:
      return state
  }
}

export function usePila() {
  const [pila, dispatch] = useReducer(pilaReducer, [])

  const agregar = (mov: MovimientoPendiente) =>
    dispatch({ type: 'ADD', movimiento: mov })

  const eliminar = (index: number) =>
    dispatch({ type: 'REMOVE', index })

  const vaciar = () =>
    dispatch({ type: 'CLEAR' })

  return { pila, agregar, eliminar, vaciar }
}
