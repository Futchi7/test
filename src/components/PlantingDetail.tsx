import { useCallback, useEffect, useState } from 'react'
import type { LogEntry, Planting } from '../types'
import { getVariety } from '../lib/varieties'
import { formatDateJa } from '../lib/format'
import { useReadiness } from '../hooks/useReadiness'
import * as storage from '../lib/storage'
import { ReadinessCard } from './ReadinessCard'
import { LogForm } from './LogForm'
import { LogTimeline } from './LogTimeline'
import { SensorPanel } from './SensorPanel'

interface Props {
  planting: Planting
  onBack: () => void
  onDeleted: () => void
}

export function PlantingDetail({ planting, onBack, onDeleted }: Props) {
  const { readiness, error, loading } = useReadiness(planting)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const variety = getVariety(planting.varietyId)
  const varietyName = planting.customVarietyName || variety.name

  const reloadLogs = useCallback(async () => {
    const list = await storage.listLogs(planting.id)
    setLogs(list)
  }, [planting.id])

  useEffect(() => {
    reloadLogs()
  }, [reloadLogs])

  async function handleDeletePlanting() {
    if (!confirm(`「${planting.plotName}」を削除します。よろしいですか?`)) return
    await storage.deletePlanting(planting.id)
    onDeleted()
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="link-button" onClick={onBack}>
          ← 一覧に戻る
        </button>
        <h1>{planting.plotName}</h1>
        <p className="subtitle">
          {varietyName} ・ 植付日 {formatDateJa(planting.plantedDate)}
        </p>
      </div>

      <ReadinessCard planting={planting} readiness={readiness} loading={loading} error={error} />

      <SensorPanel plantingId={planting.id} onSaved={reloadLogs} />

      <div className="card">
        <h2>記録を追加</h2>
        <LogForm plantingId={planting.id} onSaved={reloadLogs} />
      </div>

      <div className="card">
        <h2>記録の履歴</h2>
        <LogTimeline logs={logs} onChanged={reloadLogs} />
      </div>

      <button className="link-button link-button-danger" onClick={handleDeletePlanting}>
        この畝を削除する
      </button>
    </div>
  )
}
