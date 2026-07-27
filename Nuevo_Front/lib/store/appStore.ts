// ─── Store global (Zustand) ───────────────────────────────────────────────────
//
// Fuentes de datos:
//   - user:         GET /api/me  → normalizarUser() en lib/api/auth.ts
//   - arco/saldo:   GET /api/arco-estado + /api/saldo-ultimo-arco
//
// SaldoArco del backend (VistaSaldoArqueo):
//   saldo_total, saldo_inicial, total_ingresos, total_egresos, total_retiros

import { create } from 'zustand'
import { User }   from '@/types/user'
import { Arco, SaldoArco, TipoCaja } from '@/types/arco'

interface AppState {
  // Autenticación
  user:        User | null
  permissions: string[]
  role:        string

  // Arco activo
  arco:         Arco | null
  arcoAbierto:  boolean

  // Saldo (de VistaSaldoArqueo)
  saldoActual:   number   // = saldo_total
  saldoInicial:  number
  totalIngresos: number
  totalEgresos:  number
  totalRetiros:  number

  // Tipo de caja (solo relevante para Admin General)
  tipoCaja: TipoCaja

  // Acciones
  setUser:     (user: User)              => void
  clearUser:   ()                        => void
  setArco:     (arco: Arco | null, abierto: boolean) => void
  setSaldo:    (saldo: SaldoArco)        => void
  setTipoCaja: (tipo: TipoCaja)          => void
}

export const useAppStore = create<AppState>((set) => ({
  user:        null,
  permissions: [],
  role:        '',

  arco:         null,
  arcoAbierto:  false,

  saldoActual:   0,
  saldoInicial:  0,
  totalIngresos: 0,
  totalEgresos:  0,
  totalRetiros:  0,

  tipoCaja: 'personal',

  setUser: (user) =>
    set({
      user,
      permissions: user.permissions ?? [],
      role:        user.role ?? '',
    }),

  clearUser: () =>
    set({ user: null, permissions: [], role: '' }),

  setArco: (arco, abierto) =>
    set({
      arco,
      arcoAbierto:  abierto,
      saldoInicial: arco?.saldo_inicial ?? 0,
    }),

  // Recibe el objeto VistaSaldoArqueo del backend directamente
  setSaldo: (s) =>
    set({
      saldoActual:   s.saldo_total    ?? 0,
      saldoInicial:  s.saldo_inicial  ?? 0,
      totalIngresos: s.total_ingresos ?? 0,
      totalEgresos:  s.total_egresos  ?? 0,
      totalRetiros:  s.total_retiros  ?? 0,
    }),

  setTipoCaja: (tipo) => set({ tipoCaja: tipo }),
}))
