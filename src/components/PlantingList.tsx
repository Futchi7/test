import type { Planting } from '../types'
import { getVariety } from '../lib/varieties'
import { formatDateJa } from '../lib/format'

interface Props {
  plantings: Planting[]
  onSelect: (id: string) => void
  onNew: () => void
}

export function PlantingList({ plantings, onSelect, onNew }: Props) {
  return (
    <div className="screen">
      <div className="screen-header">
        <h1>いも掘りナビ</h1>
        <p className="subtitle">畑ごとの収穫適期を目安で管理します</p>
      </div>

      {plantings.length === 0 ? (
        <div className="empty-state">
          <p>まだ登録した畝がありません。</p>
          <p>植え付けた畝を登録して、収穫適期の目安を確認しましょう。</p>
        </div>
      ) : (
        <ul className="planting-list">
          {plantings.map((p) => {
            const variety = getVariety(p.varietyId)
            const varietyName = p.customVarietyName || variety.name
            return (
              <li key={p.id}>
                <button className="planting-row" onClick={() => onSelect(p.id)}>
                  <div className="planting-row-main">
                    <span className="planting-row-plot">{p.plotName}</span>
                    <span className="planting-row-variety">{varietyName}</span>
                  </div>
                  <div className="planting-row-sub">
                    植付: {formatDateJa(p.plantedDate)}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <button className="fab" onClick={onNew} aria-label="新しい畝を登録">
        ＋ 畝を登録
      </button>
    </div>
  )
}
