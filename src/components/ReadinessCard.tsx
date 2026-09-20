import { useEffect, useState } from 'react'
import type { Planting, ReadinessResult } from '../types'
import { StatusBadge } from './StatusBadge'
import { formatDateJa } from '../lib/format'
import {
  maybeNotifyReadiness,
  notificationPermission,
  notificationsSupported,
  requestNotificationPermission,
} from '../lib/notify'

interface Props {
  planting: Planting
  readiness: ReadinessResult | null
  loading: boolean
  error: string | null
}

export function ReadinessCard({ planting, readiness, loading, error }: Props) {
  const [permission, setPermission] = useState<NotificationPermission>(
    notificationPermission(),
  )

  useEffect(() => {
    if (readiness) maybeNotifyReadiness(planting, readiness)
  }, [planting, readiness])

  async function handleEnableNotifications() {
    const result = await requestNotificationPermission()
    setPermission(result)
  }

  if (!readiness) {
    return (
      <div className="card">
        <p>{loading ? '収穫適期を計算中…' : '収穫適期の情報がありません'}</p>
      </div>
    )
  }

  const barWidth = Math.min(100, readiness.progressPercent)

  return (
    <div className="card">
      <div className="card-header-row">
        <h2>収穫適期の目安</h2>
        <StatusBadge status={readiness.status} />
      </div>

      <div className="progress-bar">
        <div
          className={`progress-bar-fill progress-${readiness.status}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <p className="progress-label">進捗 約{Math.round(readiness.progressPercent)}%</p>

      <dl className="stat-list">
        <div>
          <dt>植付からの経過日数</dt>
          <dd>{readiness.daysSincePlanting}日</dd>
        </div>
        <div>
          <dt>目安の収穫時期(日数ベース)</dt>
          <dd>
            {formatDateJa(readiness.naiveWindowStart)} 〜{' '}
            {formatDateJa(readiness.naiveWindowEnd)}
          </dd>
        </div>
        {readiness.weatherAvailable && readiness.estimatedHarvestDate && (
          <div>
            <dt>気象データを反映した推定日</dt>
            <dd>{formatDateJa(readiness.estimatedHarvestDate)}頃</dd>
          </div>
        )}
      </dl>

      {!readiness.weatherAvailable && (
        <p className="hint">
          位置情報が未設定、または気象データが取得できないため、経過日数ベースの目安のみ表示しています。
        </p>
      )}
      {error && <p className="hint hint-warn">{error}</p>}

      {(readiness.status === 'approaching' || readiness.status === 'ready') && (
        <p className="callout">
          そろそろ試し掘り・試し刺しで実際の大きさを確認しましょう。
        </p>
      )}

      {notificationsSupported() && permission !== 'granted' && (
        <button className="secondary-button" onClick={handleEnableNotifications}>
          収穫適期が近づいたら通知する
        </button>
      )}

      <p className="disclaimer">
        ※ この予測は品種の一般的な目安栽培日数と気象データから算出した簡易推定です。
        実際の生育は土壌・天候・栽培方法で変わるため、最終判断は試し掘りで行ってください。
      </p>
    </div>
  )
}
