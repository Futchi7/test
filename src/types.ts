export type VarietyId = string

export interface Variety {
  id: VarietyId
  name: string
  /** GDD計算の基準温度(℃)。この気温を超えた分だけ生育が進むとみなす */
  baseTempC: number
  /** 平年並みの気候で目安日数どおりに育った場合の日平均GDD(進捗率算出の基準値) */
  referenceDailyGDD: number
  typicalDaysMin: number
  typicalDaysMax: number
  note?: string
}

export const CUSTOM_VARIETY_ID = 'custom'

export interface Planting {
  id: string
  plotName: string
  varietyId: VarietyId
  customVarietyName?: string
  customTypicalDaysMin?: number
  customTypicalDaysMax?: number
  plantedDate: string
  lat?: number
  lon?: number
  createdAt: string
  archived?: boolean
}

export type LogKind = 'test_dig' | 'probe' | 'observation' | 'sensor' | 'harvest'

export const LOG_KIND_LABEL: Record<LogKind, string> = {
  test_dig: '試し掘り',
  probe: '試し刺し',
  observation: '観察メモ',
  sensor: 'センサー記録',
  harvest: '収穫',
}

export interface SensorReading {
  moisturePercent?: number
  temperatureC?: number
  ecMScm?: number
  deviceName?: string
  simulated?: boolean
}

export interface LogEntry {
  id: string
  plantingId: string
  kind: LogKind
  date: string
  memo?: string
  estimatedSizeCm?: number
  photo?: Blob
  sensorReading?: SensorReading
  createdAt: string
}

export interface DailyWeather {
  date: string
  tMaxC: number
  tMinC: number
  isForecast: boolean
}

export type ReadinessStatus = 'growing' | 'approaching' | 'ready' | 'overdue'

export interface ReadinessResult {
  accumulatedGDD: number
  referenceGDD: number
  progressPercent: number
  daysSincePlanting: number
  estimatedTotalDays: number | null
  estimatedHarvestDate: string | null
  naiveWindowStart: string
  naiveWindowEnd: string
  status: ReadinessStatus
  weatherAvailable: boolean
}
