import { useState } from 'react'
import { VARIETIES, CUSTOM_VARIETY_ID } from '../lib/varieties'
import { getCurrentPosition } from '../lib/weather'
import { todayInputValue } from '../lib/format'
import type { Planting } from '../types'
import * as storage from '../lib/storage'

interface Props {
  onCreated: (planting: Planting) => void
  onCancel: () => void
}

export function PlantingForm({ onCreated, onCancel }: Props) {
  const [plotName, setPlotName] = useState('')
  const [varietyId, setVarietyId] = useState(VARIETIES[0].id)
  const [customVarietyName, setCustomVarietyName] = useState('')
  const [customDaysMin, setCustomDaysMin] = useState('110')
  const [customDaysMax, setCustomDaysMax] = useState('140')
  const [plantedDate, setPlantedDate] = useState(todayInputValue())
  const [lat, setLat] = useState<number | null>(null)
  const [lon, setLon] = useState<number | null>(null)
  const [locationStatus, setLocationStatus] = useState<
    'idle' | 'loading' | 'done' | 'error'
  >('idle')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCustom = varietyId === CUSTOM_VARIETY_ID

  async function handleUseLocation() {
    setLocationStatus('loading')
    try {
      const pos = await getCurrentPosition({ timeout: 10000 })
      setLat(pos.coords.latitude)
      setLon(pos.coords.longitude)
      setLocationStatus('done')
    } catch {
      setLocationStatus('error')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!plotName.trim()) {
      setError('畑・畝の名前を入力してください')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const planting = await storage.savePlanting({
        plotName: plotName.trim(),
        varietyId,
        customVarietyName: isCustom ? customVarietyName.trim() || '品種不明' : undefined,
        customTypicalDaysMin: isCustom ? Number(customDaysMin) || undefined : undefined,
        customTypicalDaysMax: isCustom ? Number(customDaysMax) || undefined : undefined,
        plantedDate,
        lat: lat ?? undefined,
        lon: lon ?? undefined,
      })
      onCreated(planting)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="link-button" onClick={onCancel}>
          ← 一覧に戻る
        </button>
        <h1>畝を登録</h1>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span>畑・畝の名前</span>
          <input
            value={plotName}
            onChange={(e) => setPlotName(e.target.value)}
            placeholder="例: 東の畑 1畝目"
          />
        </label>

        <label className="field">
          <span>品種</span>
          <select value={varietyId} onChange={(e) => setVarietyId(e.target.value)}>
            {VARIETIES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>

        {isCustom && (
          <>
            <label className="field">
              <span>品種名(任意)</span>
              <input
                value={customVarietyName}
                onChange={(e) => setCustomVarietyName(e.target.value)}
                placeholder="例: 地元の在来種"
              />
            </label>
            <div className="field-row">
              <label className="field">
                <span>目安日数(最短)</span>
                <input
                  type="number"
                  value={customDaysMin}
                  onChange={(e) => setCustomDaysMin(e.target.value)}
                />
              </label>
              <label className="field">
                <span>目安日数(最長)</span>
                <input
                  type="number"
                  value={customDaysMax}
                  onChange={(e) => setCustomDaysMax(e.target.value)}
                />
              </label>
            </div>
          </>
        )}

        <label className="field">
          <span>植付日</span>
          <input
            type="date"
            value={plantedDate}
            onChange={(e) => setPlantedDate(e.target.value)}
          />
        </label>

        <div className="field">
          <span>畑の位置情報(任意・気象データ連携に利用)</span>
          <button
            type="button"
            className="secondary-button"
            onClick={handleUseLocation}
            disabled={locationStatus === 'loading'}
          >
            {locationStatus === 'loading' ? '取得中…' : '現在地を使う'}
          </button>
          {locationStatus === 'done' && lat != null && lon != null && (
            <p className="hint">
              取得しました({lat.toFixed(3)}, {lon.toFixed(3)})
            </p>
          )}
          {locationStatus === 'error' && (
            <p className="hint hint-warn">
              位置情報を取得できませんでした。位置情報なしでも経過日数ベースの目安は表示されます。
            </p>
          )}
        </div>

        {error && <p className="hint hint-warn">{error}</p>}

        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? '登録中…' : '登録する'}
        </button>
      </form>
    </div>
  )
}
