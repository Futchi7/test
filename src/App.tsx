import { useState } from 'react'
import { usePlantings } from './hooks/usePlantings'
import { PlantingList } from './components/PlantingList'
import { PlantingForm } from './components/PlantingForm'
import { PlantingDetail } from './components/PlantingDetail'

type View = { kind: 'list' } | { kind: 'new' } | { kind: 'detail'; id: string }

export default function App() {
  const { plantings, reload } = usePlantings()
  const [view, setView] = useState<View>({ kind: 'list' })

  const selected =
    view.kind === 'detail' ? plantings.find((p) => p.id === view.id) : undefined

  return (
    <div className="app-shell">
      {view.kind === 'list' && (
        <PlantingList
          plantings={plantings}
          onSelect={(id) => setView({ kind: 'detail', id })}
          onNew={() => setView({ kind: 'new' })}
        />
      )}

      {view.kind === 'new' && (
        <PlantingForm
          onCreated={async (planting) => {
            await reload()
            setView({ kind: 'detail', id: planting.id })
          }}
          onCancel={() => setView({ kind: 'list' })}
        />
      )}

      {view.kind === 'detail' &&
        (selected ? (
          <PlantingDetail
            planting={selected}
            onBack={() => setView({ kind: 'list' })}
            onDeleted={async () => {
              await reload()
              setView({ kind: 'list' })
            }}
          />
        ) : (
          <div className="screen">
            <p>読み込み中…</p>
          </div>
        ))}
    </div>
  )
}
