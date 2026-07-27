'use client'

// ─── Hook: Calculadora de billetes ───────────────────────────────────────────
// Maneja el conteo de billetes para cierre de arqueo y retiro.
// Reemplaza la lógica de billCounts / retiroBillCounts del movimiento.js.

import { useReducer, useCallback } from 'react'

export const DENOMINACIONES = [20000, 10000, 2000, 1000] as const
export type Denominacion = (typeof DENOMINACIONES)[number] | 'resto'

export type BillState = Record<string, number> & {
  20000: number
  10000: number
  2000: number
  1000: number
  resto: number
}

const INITIAL: BillState = { 20000: 0, 10000: 0, 2000: 0, 1000: 0, resto: 0 }

type Action =
  | { type: 'SET'; denom: string; value: number }
  | { type: 'INCREMENT'; denom: string }
  | { type: 'DECREMENT'; denom: string }
  | { type: 'RESET' }

function reducer(state: BillState, action: Action): BillState {
  switch (action.type) {
    case 'SET':
      return { ...state, [action.denom]: Math.max(0, action.value) }
    case 'INCREMENT':
      return { ...state, [action.denom]: (state[action.denom] ?? 0) + 1 }
    case 'DECREMENT':
      return { ...state, [action.denom]: Math.max(0, (state[action.denom] ?? 0) - 1) }
    case 'RESET':
      return { ...INITIAL }
    default:
      return state
  }
}

export function useBillCalculator() {
  const [bills, dispatch] = useReducer(reducer, { ...INITIAL })

  const set = useCallback((denom: string, value: number) =>
    dispatch({ type: 'SET', denom, value }), [])

  const increment = useCallback((denom: string) =>
    dispatch({ type: 'INCREMENT', denom }), [])

  const decrement = useCallback((denom: string) =>
    dispatch({ type: 'DECREMENT', denom }), [])

  const reset = useCallback(() => dispatch({ type: 'RESET' }), [])

  // Calcula el total considerando que 'resto' es monto directo y el resto es cantidad × denominación
  const total = Object.entries(bills).reduce((acc, [denom, count]) => {
    if (denom === 'resto') return acc + count
    return acc + Number(denom) * count
  }, 0)

  return { bills, total, set, increment, decrement, reset }
}
