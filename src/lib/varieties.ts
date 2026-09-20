import { CUSTOM_VARIETY_ID, type Variety } from '../types'

export { CUSTOM_VARIETY_ID }

/**
 * 目安値は一般的な栽培情報をもとにした簡易推定です。
 * 地域・気候・土壌・栽培方法によって実際の収穫適期は変動するため、
 * このアプリの予測はあくまで「試し掘りのタイミングの目安」として扱ってください。
 */
export const VARIETIES: Variety[] = [
  {
    id: 'beni-haruka',
    name: '紅はるか',
    baseTempC: 15,
    referenceDailyGDD: 8,
    typicalDaysMin: 120,
    typicalDaysMax: 150,
    note: '貯蔵で甘みが増すタイプ。やや長めに置くと食味が向上',
  },
  {
    id: 'annou-imo',
    name: '安納芋',
    baseTempC: 15,
    referenceDailyGDD: 8,
    typicalDaysMin: 120,
    typicalDaysMax: 140,
  },
  {
    id: 'beni-azuma',
    name: '紅あずま',
    baseTempC: 15,
    referenceDailyGDD: 8,
    typicalDaysMin: 110,
    typicalDaysMax: 130,
  },
  {
    id: 'silk-sweet',
    name: 'シルクスイート',
    baseTempC: 15,
    referenceDailyGDD: 8,
    typicalDaysMin: 120,
    typicalDaysMax: 140,
  },
  {
    id: 'purple-sweet-road',
    name: 'パープルスイートロード',
    baseTempC: 15,
    referenceDailyGDD: 8,
    typicalDaysMin: 120,
    typicalDaysMax: 140,
  },
  {
    id: 'naruto-kintoki',
    name: '鳴門金時',
    baseTempC: 15,
    referenceDailyGDD: 8,
    typicalDaysMin: 110,
    typicalDaysMax: 130,
  },
  {
    id: CUSTOM_VARIETY_ID,
    name: 'カスタム(手入力)',
    baseTempC: 15,
    referenceDailyGDD: 8,
    typicalDaysMin: 110,
    typicalDaysMax: 140,
    note: '品種名・目安日数を自分で入力します',
  },
]

export function getVariety(id: string): Variety {
  return VARIETIES.find((v) => v.id === id) ?? VARIETIES[VARIETIES.length - 1]
}
