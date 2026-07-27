'use client'

import { useState } from 'react'
import { useArco, ArcoConflictError } from '@/lib/hooks/useArco'
import { useBillCalculator } from '@/lib/hooks/useBillCalculator'
import { useNotification } from '@/components/ui/Notification'
import { Modal } from '@/components/ui/Modal'
import { BillCalculator } from './BillCalculator'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

interface ResumenData {
  arco: any
  totalContado: number
  retiroMonto: number
  diferencia: number
}

export function ArqueoToggle() {
  const { arcoAbierto, saldoActual, arco, abrir, cerrar } = useArco()
  const { show } = useNotification()

  const [showCierre, setShowCierre] = useState(false)
  const [showRetiro, setShowRetiro] = useState(false)
  const [showResumen, setShowResumen] = useState(false)
  const [showConflict, setShowConflict] = useState(false)
  const [conflictArco, setConflictArco] = useState<any>(null)
  const [resumenData, setResumenData] = useState<ResumenData | null>(null)
  const [totalContadoCierre, setTotalContadoCierre] = useState(0)
  const [turnoSolicitado, setTurnoSolicitado] = useState<'M' | 'T'>('M')
  const [loading, setLoading] = useState(false)

  const cierreBills = useBillCalculator()
  const retiroBills = useBillCalculator()

  const handleAbrir = async (forzarNuevo = false, turno = turnoSolicitado) => {
    setLoading(true)
    try {
      await abrir(turno, forzarNuevo)
      show('Caja abierta correctamente', 'success')
      setShowConflict(false)
    } catch (err: any) {
      if (err instanceof ArcoConflictError) {
        setConflictArco(err.arco)
        setShowConflict(true)
      } else {
        show(err.message ?? 'Error al abrir arqueo', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const iniciarApertura = () => {
    const turno: 'M' | 'T' = new Date().getHours() < 14 ? 'M' : 'T'
    setTurnoSolicitado(turno)
    handleAbrir(false, turno)
  }

  const handleConfirmarCierre = () => {
    const diferencia = cierreBills.total - saldoActual
    if (Math.abs(diferencia) > 0.01) {
      const ok = confirm(
        `Atencion: hay una diferencia de ${fmt(Math.abs(diferencia))} ${diferencia > 0 ? 'de mas' : 'de menos'}.\n\n` +
        `Total contado: ${fmt(cierreBills.total)}\nSaldo del sistema: ${fmt(saldoActual)}\n\n` +
        'Desea cerrar el arqueo con esta diferencia?'
      )
      if (!ok) return
    }

    setTotalContadoCierre(cierreBills.total)
    setShowCierre(false)
    retiroBills.reset()
    setShowRetiro(true)
  }

  const procesarCierre = async (retiroMonto: number) => {
    setShowRetiro(false)
    setLoading(true)
    try {
      const result = await cerrar(totalContadoCierre, retiroMonto)
      cierreBills.reset()
      retiroBills.reset()
      setResumenData({
        arco: result.arco ?? arco,
        totalContado: totalContadoCierre,
        retiroMonto,
        diferencia: result.diferencia ?? 0,
      })
      setShowResumen(true)
    } catch (err: any) {
      show(err.message ?? 'Error al cerrar arqueo', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-lg font-bold ${arcoAbierto ? 'text-emerald-600' : 'text-gray-500'}`}>
              {arcoAbierto ? 'Arqueo abierto' : 'Arqueo cerrado'}
            </p>
            <p className="text-sm text-gray-400 mt-0.5">
              {arcoAbierto ? 'Presiona para cerrar el arqueo actual' : 'Presiona para abrir un nuevo arqueo'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (arcoAbierto) {
                cierreBills.reset()
                setShowCierre(true)
              } else {
                iniciarApertura()
              }
            }}
            disabled={loading}
            className={`relative inline-flex items-center shrink-0 w-16 h-8 rounded-full border-0 p-0 transition-colors duration-300 focus:outline-none focus:ring-4
              ${arcoAbierto ? 'bg-emerald-500 focus:ring-emerald-200' : 'bg-gray-300 focus:ring-gray-200'}
              ${loading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
            aria-label={arcoAbierto ? 'Cerrar arqueo' : 'Abrir arqueo'}
          >
            <span className={`inline-block w-6 h-6 bg-white rounded-full shadow transform transition-transform duration-300
              ${arcoAbierto ? 'translate-x-9' : 'translate-x-1'}`}
            />
          </button>
        </div>
      </div>

      <Modal
        open={showConflict}
        onClose={() => setShowConflict(false)}
        title="Ya hay una caja abierta"
        maxWidth="max-w-sm"
        headerClass="bg-gradient-to-r from-amber-500 to-orange-500"
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowConflict(false)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => handleAbrir(true)}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-colors"
            >
              Abrir nueva caja
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Ya existe una caja personal abierta.
            {conflictArco && (
              <span> Turno: <strong>{conflictArco.turno === 'M' ? 'Manana' : 'Tarde'}</strong></span>
            )}
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
            Si abres una nueva, la anterior quedara cerrada automaticamente por el sistema.
          </div>
        </div>
      </Modal>

      <Modal
        open={showCierre}
        onClose={() => setShowCierre(false)}
        title="Conteo de Billetes - Cierre de Arqueo"
        maxWidth="max-w-xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowCierre(false)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmarCierre}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
            >
              Confirmar Cierre
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-800">Contar billetes fisicos</h4>
            <p className="text-sm text-gray-500">Ingresa la cantidad de billetes que tienes fisicamente en caja.</p>
          </div>
          <BillCalculator calculator={cierreBills} saldoSistema={saldoActual} />
        </div>
      </Modal>

      <Modal
        open={showRetiro}
        onClose={() => procesarCierre(0)}
        title="Retiro de Caja"
        headerClass="bg-gradient-to-r from-red-500 to-red-600"
        maxWidth="max-w-xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => procesarCierre(0)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Omitir Retiro
            </button>
            <button
              type="button"
              onClick={() => procesarCierre(retiroBills.total)}
              className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors"
            >
              Confirmar Retiro
            </button>
          </>
        }
      >
        <p className="text-gray-600 text-sm mb-4">Conteo de billetes para retiro. Puedes dejarlo en 0 si no deseas retirar efectivo.</p>
        <BillCalculator calculator={retiroBills} totalLabel="Total a retirar" />
      </Modal>

      {resumenData && (
        <Modal
          open={showResumen}
          onClose={() => setShowResumen(false)}
          title="Resumen de Cierre"
          headerClass="bg-gradient-to-r from-emerald-500 to-emerald-600"
          maxWidth="max-w-md"
          footer={
            <>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
              >
                Imprimir Tirilla
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResumen(false)
                  show('Arqueo cerrado correctamente', 'success')
                }}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition-colors"
              >
                Aceptar
              </button>
            </>
          }
        >
          <div id="tirilla-print" className="font-mono text-sm space-y-1">
            <div className="text-center border-b-2 border-dashed border-gray-400 pb-3 mb-3">
              <p className="font-bold text-lg">MEGAADMIN</p>
              <p className="text-gray-500">Cierre de Caja</p>
              <p className="text-gray-400 text-xs">{new Date().toLocaleString('es-AR')}</p>
            </div>

            {resumenData.arco && (
              <div className="space-y-1 pb-3 border-b border-dashed border-gray-300">
                <Row label="Usuario" value={resumenData.arco.usuario?.full_name ?? resumenData.arco.owner?.full_name ?? '-'} />
                <Row label="Turno" value={resumenData.arco.turno === 'M' ? 'Manana' : 'Tarde'} />
              </div>
            )}

            <div className="space-y-1 py-3">
              <Row label="Saldo Inicial" value={fmt(resumenData.arco?.saldo_inicial ?? 0)} />
              <Row label="+ Ingresos" value={fmt(resumenData.arco?.total_ingresos ?? 0)} colorClass="text-emerald-600" />
              <Row label="- Egresos" value={fmt(resumenData.arco?.total_egresos ?? 0)} colorClass="text-red-500" />
              {resumenData.retiroMonto > 0 && (
                <Row label="- Retiro" value={fmt(resumenData.retiroMonto)} colorClass="text-amber-600" />
              )}
              <div className="border-t-2 border-b-2 border-gray-800 py-1 mt-2">
                <Row label="SALDO FINAL" value={fmt(resumenData.arco?.saldo_final ?? 0)} bold />
              </div>
            </div>

            {resumenData.totalContado > 0 && (
              <div className="pt-3 border-t border-dashed border-gray-300 space-y-1">
                <Row label="Total Contado" value={fmt(resumenData.totalContado)} />
                <Row
                  label="Diferencia"
                  value={fmt(resumenData.diferencia)}
                  colorClass={resumenData.diferencia === 0 ? 'text-emerald-600' : 'text-amber-600'}
                />
              </div>
            )}

            <div className="text-center border-t-2 border-dashed border-gray-400 pt-3 mt-3 text-xs text-gray-400">
              Gracias por usar MegaAdmin
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

function Row({ label, value, colorClass = '', bold = false }: {
  label: string
  value: string
  colorClass?: string
  bold?: boolean
}) {
  return (
    <div className={`flex justify-between gap-4 ${bold ? 'font-bold' : ''}`}>
      <span className="text-gray-600">{label}:</span>
      <span className={colorClass}>{value}</span>
    </div>
  )
}
