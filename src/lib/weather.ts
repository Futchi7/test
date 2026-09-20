import type { DailyWeather } from '../types'

const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive'

interface OpenMeteoDailyResponse {
  daily?: {
    time: string[]
    temperature_2m_max: (number | null)[]
    temperature_2m_min: (number | null)[]
  }
}

/**
 * Open-Meteo archive API (APIキー不要) から日別の最高・最低気温を取得する。
 * 直近数日分はまだ確定値が公開されていないことがあり、その場合は欠測として扱う。
 */
export async function fetchDailyWeather(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
): Promise<DailyWeather[]> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: startDate,
    end_date: endDate,
    daily: 'temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
  })

  const res = await fetch(`${ARCHIVE_URL}?${params.toString()}`)
  if (!res.ok) {
    throw new Error(`気象データの取得に失敗しました (HTTP ${res.status})`)
  }
  const json = (await res.json()) as OpenMeteoDailyResponse
  if (!json.daily) return []

  const { time, temperature_2m_max, temperature_2m_min } = json.daily
  const result: DailyWeather[] = []
  for (let i = 0; i < time.length; i++) {
    const tMax = temperature_2m_max[i]
    const tMin = temperature_2m_min[i]
    if (tMax == null || tMin == null) continue
    result.push({ date: time[i], tMaxC: tMax, tMinC: tMin, isForecast: false })
  }
  return result
}

export function getCurrentPosition(
  options?: PositionOptions,
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('この端末は位置情報に対応していません'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}
