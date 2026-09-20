import type { DailyWeather, Planting, ReadinessResult, ReadinessStatus, Variety } from '../types'

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`)
}

function addDays(iso: string, days: number): string {
  const d = toDate(iso)
  d.setDate(d.getDate() + Math.round(days))
  return d.toISOString().slice(0, 10)
}

function diffDays(fromIso: string, toIso: string): number {
  const ms = toDate(toIso).getTime() - toDate(fromIso).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** 積算有効温度(Growing Degree Days)を計算する */
export function computeAccumulatedGDD(weather: DailyWeather[], baseTempC: number): number {
  return weather.reduce((sum, day) => {
    const mean = (day.tMaxC + day.tMinC) / 2
    return sum + Math.max(0, mean - baseTempC)
  }, 0)
}

function statusFromProgress(progressPercent: number): ReadinessStatus {
  if (progressPercent < 70) return 'growing'
  if (progressPercent < 95) return 'approaching'
  if (progressPercent <= 115) return 'ready'
  return 'overdue'
}

export interface EffectiveVariety {
  baseTempC: number
  referenceDailyGDD: number
  typicalDaysMin: number
  typicalDaysMax: number
}

export function effectiveVariety(variety: Variety, planting: Planting): EffectiveVariety {
  return {
    baseTempC: variety.baseTempC,
    referenceDailyGDD: variety.referenceDailyGDD,
    typicalDaysMin: planting.customTypicalDaysMin ?? variety.typicalDaysMin,
    typicalDaysMax: planting.customTypicalDaysMax ?? variety.typicalDaysMax,
  }
}

/**
 * 収穫適期の進捗を推定する。
 *
 * 前提(いずれも簡易的な目安であり、実測の試し掘りに置き換わるものではない):
 * - 品種ごとの「目安栽培日数」から、平年並みの気候で到達するはずの基準GDDを逆算する
 * - 実際の気象データ(気温)から積算GDDを計算し、基準GDDとの比率で進捗率を出す
 * - 気象データが取得できない場合は、経過日数ベースの進捗率にフォールバックする
 */
export function calcReadiness(
  planting: Planting,
  variety: EffectiveVariety,
  weather: DailyWeather[],
  today: string = todayIso(),
): ReadinessResult {
  const daysSincePlanting = Math.max(0, diffDays(planting.plantedDate, today))
  const typicalDaysAvg = (variety.typicalDaysMin + variety.typicalDaysMax) / 2
  const referenceGDD = typicalDaysAvg * variety.referenceDailyGDD

  const relevantWeather = weather.filter(
    (w) => w.date >= planting.plantedDate && w.date <= today,
  )
  const accumulatedGDD = computeAccumulatedGDD(relevantWeather, variety.baseTempC)
  const weatherAvailable = relevantWeather.length >= Math.min(7, daysSincePlanting || 1)

  const dayBasedProgress = typicalDaysAvg > 0 ? (daysSincePlanting / typicalDaysAvg) * 100 : 0
  const weatherBasedProgress = referenceGDD > 0 ? (accumulatedGDD / referenceGDD) * 100 : 0

  const progressPercent = Math.min(
    300,
    weatherAvailable ? weatherBasedProgress : dayBasedProgress,
  )

  let estimatedTotalDays: number | null = null
  if (weatherAvailable && weatherBasedProgress > 1) {
    estimatedTotalDays = daysSincePlanting / (weatherBasedProgress / 100)
  } else if (daysSincePlanting > 0) {
    estimatedTotalDays = typicalDaysAvg
  }

  const estimatedHarvestDate =
    estimatedTotalDays != null && Number.isFinite(estimatedTotalDays)
      ? addDays(planting.plantedDate, estimatedTotalDays)
      : null

  return {
    accumulatedGDD,
    referenceGDD,
    progressPercent,
    daysSincePlanting,
    estimatedTotalDays,
    estimatedHarvestDate,
    naiveWindowStart: addDays(planting.plantedDate, variety.typicalDaysMin),
    naiveWindowEnd: addDays(planting.plantedDate, variety.typicalDaysMax),
    status: statusFromProgress(progressPercent),
    weatherAvailable,
  }
}
