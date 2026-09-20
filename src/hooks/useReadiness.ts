import { useEffect, useState } from 'react'
import type { Planting, ReadinessResult } from '../types'
import { fetchDailyWeather } from '../lib/weather'
import { calcReadiness, effectiveVariety, todayIso } from '../lib/gdd'
import { getVariety } from '../lib/varieties'

export function useReadiness(planting: Planting | undefined) {
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!planting) {
      setReadiness(null)
      return
    }
    let cancelled = false
    const variety = getVariety(planting.varietyId)
    const eff = effectiveVariety(variety, planting)

    async function run() {
      if (!planting) return
      setLoading(true)
      setError(null)
      try {
        if (planting.lat != null && planting.lon != null) {
          const weather = await fetchDailyWeather(
            planting.lat,
            planting.lon,
            planting.plantedDate,
            todayIso(),
          )
          if (!cancelled) setReadiness(calcReadiness(planting, eff, weather))
        } else if (!cancelled) {
          setReadiness(calcReadiness(planting, eff, []))
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '気象データの取得に失敗しました')
          setReadiness(calcReadiness(planting, eff, []))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [planting])

  return { readiness, error, loading }
}
