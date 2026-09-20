import { useEffect, useState } from 'react'
import type { LogEntry } from '../types'
import { LOG_KIND_LABEL } from '../types'
import { formatDateJa } from '../lib/format'
import * as storage from '../lib/storage'

function PhotoThumb({ photo }: { photo: Blob }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const objectUrl = URL.createObjectURL(photo)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [photo])
  if (!url) return null
  return <img className="log-photo" src={url} alt="記録写真" />
}

interface Props {
  logs: LogEntry[]
  onChanged: () => void
}

export function LogTimeline({ logs, onChanged }: Props) {
  async function handleDelete(id: string) {
    await storage.deleteLog(id)
    onChanged()
  }

  if (logs.length === 0) {
    return <p className="hint">まだ記録がありません。試し掘りや観察の記録を残しましょう。</p>
  }

  return (
    <ul className="log-timeline">
      {logs.map((log) => (
        <li key={log.id} className="log-item">
          <div className="log-item-header">
            <span className={`log-kind-tag log-kind-${log.kind}`}>
              {LOG_KIND_LABEL[log.kind]}
            </span>
            <span className="log-date">{formatDateJa(log.date)}</span>
            <button className="link-button link-button-danger" onClick={() => handleDelete(log.id)}>
              削除
            </button>
          </div>
          {log.photo && <PhotoThumb photo={log.photo} />}
          {log.estimatedSizeCm != null && (
            <p className="log-size">大きさ目安: 約{log.estimatedSizeCm}cm</p>
          )}
          {log.sensorReading && (
            <p className="log-sensor">
              {log.sensorReading.deviceName ?? 'センサー'} — 水分{' '}
              {log.sensorReading.moisturePercent ?? '-'}% / 地温{' '}
              {log.sensorReading.temperatureC ?? '-'}℃ / EC{' '}
              {log.sensorReading.ecMScm ?? '-'} mS/cm
            </p>
          )}
          {log.memo && <p className="log-memo">{log.memo}</p>}
        </li>
      ))}
    </ul>
  )
}
