import { useState } from 'react'
import type { LogKind, SensorReading } from '../types'
import { LOG_KIND_LABEL } from '../types'
import { todayInputValue } from '../lib/format'
import * as storage from '../lib/storage'

interface Props {
  plantingId: string
  initialKind?: LogKind
  initialSensorReading?: SensorReading
  onSaved: () => void
}

const KIND_OPTIONS: LogKind[] = ['test_dig', 'probe', 'observation', 'harvest']

export function LogForm({ plantingId, initialKind, initialSensorReading, onSaved }: Props) {
  const [kind, setKind] = useState<LogKind>(initialKind ?? 'test_dig')
  const [date, setDate] = useState(todayInputValue())
  const [memo, setMemo] = useState('')
  const [sizeCm, setSizeCm] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await storage.saveLog({
        plantingId,
        kind: initialSensorReading ? 'sensor' : kind,
        date,
        memo: memo.trim() || undefined,
        estimatedSizeCm: sizeCm ? Number(sizeCm) : undefined,
        photo: photoFile ?? undefined,
        sensorReading: initialSensorReading,
      })
      setMemo('')
      setSizeCm('')
      setPhotoFile(null)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="form form-compact" onSubmit={handleSubmit}>
      {!initialSensorReading && (
        <label className="field">
          <span>記録の種類</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as LogKind)}>
            {KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {LOG_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="field">
        <span>日付</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      <label className="field">
        <span>芋の大きさ目安(cm・任意)</span>
        <input
          type="number"
          inputMode="decimal"
          value={sizeCm}
          onChange={(e) => setSizeCm(e.target.value)}
          placeholder="例: 8"
        />
      </label>

      <label className="field">
        <span>メモ</span>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={2}
          placeholder="つるの様子、掘った感触など"
        />
      </label>

      <label className="field">
        <span>写真(任意)</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <button className="primary-button" type="submit" disabled={saving}>
        {saving ? '保存中…' : '記録を保存'}
      </button>
    </form>
  )
}
