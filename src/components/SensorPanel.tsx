import { useState } from 'react'
import type { SensorReading } from '../types'
import {
  MI_FLORA_PROFILE,
  connectAndRead,
  isWebBluetoothSupported,
  simulateReading,
} from '../lib/sensor/bleSoilSensor'
import * as storage from '../lib/storage'
import { todayInputValue } from '../lib/format'

interface Props {
  plantingId: string
  onSaved: () => void
}

export function SensorPanel({ plantingId, onSaved }: Props) {
  const [reading, setReading] = useState<SensorReading | null>(null)
  const [status, setStatus] = useState<'idle' | 'connecting' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const supported = isWebBluetoothSupported()

  async function handleConnect() {
    setStatus('connecting')
    setErrorMsg(null)
    try {
      const result = await connectAndRead(MI_FLORA_PROFILE)
      setReading(result)
      setStatus('idle')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '接続に失敗しました')
      setStatus('error')
    }
  }

  function handleSimulate() {
    setReading(simulateReading())
    setStatus('idle')
    setErrorMsg(null)
  }

  async function handleSaveReading() {
    if (!reading) return
    setSaving(true)
    try {
      await storage.saveLog({
        plantingId,
        kind: 'sensor',
        date: todayInputValue(),
        sensorReading: reading,
      })
      setReading(null)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <h2>土壌センサー連携(実験的機能)</h2>
      <p className="hint">
        スマホ単体で土中の芋の形や大きさを直接読み取ることはできません。ここではBluetooth土壌センサーの水分・地温・電気伝導度を記録し、収穫適期の判断材料として補助的に使います。
      </p>

      {!supported && (
        <p className="hint hint-warn">
          この端末/ブラウザはWeb Bluetoothに対応していません(Android版Chrome等が必要です)。下の「デモ値で試す」で動作イメージを確認できます。
        </p>
      )}

      <div className="button-row">
        <button
          className="secondary-button"
          onClick={handleConnect}
          disabled={!supported || status === 'connecting'}
        >
          {status === 'connecting' ? '接続中…' : 'センサーに接続'}
        </button>
        <button className="secondary-button" onClick={handleSimulate}>
          デモ値で試す
        </button>
      </div>

      {errorMsg && <p className="hint hint-warn">{errorMsg}</p>}

      {reading && (
        <div className="sensor-reading">
          <p>{reading.deviceName}</p>
          <dl className="stat-list">
            <div>
              <dt>水分</dt>
              <dd>{reading.moisturePercent ?? '-'}%</dd>
            </div>
            <div>
              <dt>地温</dt>
              <dd>{reading.temperatureC ?? '-'}℃</dd>
            </div>
            <div>
              <dt>電気伝導度(肥沃度目安)</dt>
              <dd>{reading.ecMScm ?? '-'} mS/cm</dd>
            </div>
          </dl>
          <button className="primary-button" onClick={handleSaveReading} disabled={saving}>
            {saving ? '保存中…' : 'この記録を保存'}
          </button>
        </div>
      )}
    </div>
  )
}
