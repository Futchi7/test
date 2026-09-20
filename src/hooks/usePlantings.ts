import { useCallback, useEffect, useState } from 'react'
import * as storage from '../lib/storage'
import type { Planting } from '../types'

export function usePlantings() {
  const [plantings, setPlantings] = useState<Planting[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const list = await storage.listPlantings()
    setPlantings(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { plantings, loading, reload }
}
