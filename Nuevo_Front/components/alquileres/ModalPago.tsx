'use client'

// ─── Modal: Registrar pago de un mes ─────────────────────────────────────────

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useNotification } from '@/components/ui/Notification'
import { registrarPago } from '@/lib/api/alquileres'
import { Propiedad } from '@/types/alquiler'
import { MESES, fmt } from './helpers'

interface Props {
  open:      boolean
  propId:    string
  mes:       number
  propiedad: Propiedad
  onClose:   () => void
  onSuccess: (prop: Propiedad) => void
}

export function ModalPago({ open, propId, mes, propiedad, onClose, onSuccess }: Props) {
  const { show } = useNotification()
  const [monto, setMonto]       = useState(String(propiedad.alquiler_mensual || ''))
  const [guardando, setGuardando] = useState(false)

  const esDolar = propiedad.paga_en_dolares

  const confirmar = async () => {
    const parsed = parseFloat(monto)
    if (!parsed || parsed <= 0) { show('Ingresá un monto válido', 'warning'); return }
    setGuardando(true)
    try {
      const res = await registrarPago(propId, mes, parsed)
      show(`✅ Pago de ${MESES[mes]} registrado`, 'success')
      onSuccess(res.propiedad)
      onClose()
    } catch (err: any) {
      show(err.message, 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="💳 Registrar Pago"
      maxWidth="max-w-sm"
      headerClass="bg-gradient-to-r from-emerald-500 to-emerald-600"
      footer={
        <>
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={confirmar} disabled={guardando}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold transition-colors flex items-center gap-2">
            {guardando ? <><span className="animate-spin">⏳</span> Guardando…</> : '✅ Confirmar'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm space-y-1">
          <p className="text-gray-600">
            Propiedad: <strong className="text-gray-800">{propiedad.direccion}</strong>
          </p>
          <p className="text-gray-600">
            Mes: <strong className="text-gray-800">{MESES[mes]}</strong>
          </p>
          {esDolar ? (
            <p className="text-green-600 font-medium">
              💵 Monto USD: <strong>USD {propiedad.monto_dolares}</strong>
            </p>
          ) : (
            <p className="text-gray-600">
              Alquiler habitual: <strong>{fmt(propiedad.alquiler_mensual)}</strong>
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Monto recibido (ARS) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            min={0}
            step={0.01}
            placeholder="0.00"
            autoFocus
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-lg font-bold text-emerald-600 focus:ring-2 focus:ring-emerald-300 focus:outline-none"
          />
        </div>
      </div>
    </Modal>
  )
}
