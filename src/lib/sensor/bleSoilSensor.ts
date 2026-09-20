import type { SensorReading } from '../../types'

/**
 * BLE土壌センサー連携(実験的機能)
 *
 * 注意: スマホ本体のセンサーで土中の芋の形状・大きさを直接読み取ることはできません。
 * ここで扱うのは市販/自作のBluetooth土壌センサーが計測する「水分量」「地温」「電気伝導度(肥沃度の目安)」で、
 * 芋の生育状況を間接的に推測するための補助データです。試し掘り・試し刺しの記録と組み合わせて使ってください。
 *
 * 対応デバイスはメーカーごとにGATTの仕様がバラバラなため、
 * 既知のプリセット(Xiaomi Mi Flora系、コミュニティ解析による非公式対応)に加えて、
 * 自作ESP32/Arduino等のBLEブロードキャスタ向けにカスタムプロファイル(Service/Characteristic UUID、
 * バイト形式を手入力)にも対応しています。
 */

export type ValueFormat = 'uint8' | 'uint16le' | 'int16le' | 'float32le'
export type SensorField = 'moisturePercent' | 'temperatureC' | 'ecMScm'

export interface CustomFieldMap {
  field: SensorField
  byteOffset: number
  format: ValueFormat
  scale: number
}

export interface SensorProfile {
  id: string
  label: string
  description: string
  serviceUuid: string
  dataCharUuid: string
  modeCharUuid?: string
  modeWriteValue?: number[]
  customFields?: CustomFieldMap[]
}

export const MI_FLORA_PROFILE: SensorProfile = {
  id: 'mi-flora',
  label: 'Xiaomi Mi Flora / Grow Care(非公式)',
  description:
    'コミュニティによる解析情報に基づく非公式対応です。ファームウェアや個体差で動作しない場合があります。',
  serviceUuid: '00001204-0000-1000-8000-00805f9b34fb',
  dataCharUuid: '00001a01-0000-1000-8000-00805f9b34fb',
  modeCharUuid: '00001a00-0000-1000-8000-00805f9b34fb',
  modeWriteValue: [0xa0, 0x1f],
}

export const CUSTOM_PROFILE_ID = 'custom'

function readValue(view: DataView, offset: number, format: ValueFormat): number {
  switch (format) {
    case 'uint8':
      return view.getUint8(offset)
    case 'uint16le':
      return view.getUint16(offset, true)
    case 'int16le':
      return view.getInt16(offset, true)
    case 'float32le':
      return view.getFloat32(offset, true)
  }
}

function decodeMiFlora(view: DataView): Partial<SensorReading> {
  return {
    temperatureC: view.getInt16(0, true) / 10,
    moisturePercent: view.getUint8(7),
    ecMScm: view.getUint16(8, true) / 1000,
  }
}

function decodeCustom(view: DataView, fields: CustomFieldMap[]): Partial<SensorReading> {
  const reading: Partial<SensorReading> = {}
  for (const f of fields) {
    if (f.byteOffset + formatByteLength(f.format) > view.byteLength) continue
    reading[f.field] = readValue(view, f.byteOffset, f.format) * f.scale
  }
  return reading
}

function formatByteLength(format: ValueFormat): number {
  switch (format) {
    case 'uint8':
      return 1
    case 'uint16le':
    case 'int16le':
      return 2
    case 'float32le':
      return 4
  }
}

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

export async function connectAndRead(profile: SensorProfile): Promise<SensorReading> {
  if (!isWebBluetoothSupported()) {
    throw new Error(
      'このブラウザ/端末はWeb Bluetoothに対応していません(Android版Chrome等をご利用ください。iOS Safariは非対応です)',
    )
  }

  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [profile.serviceUuid] }],
    optionalServices: profile.modeCharUuid ? [profile.serviceUuid] : undefined,
  })

  if (!device.gatt) {
    throw new Error('この端末はGATT接続に対応していません')
  }

  const server = await device.gatt.connect()
  try {
    const service = await server.getPrimaryService(profile.serviceUuid)

    if (profile.modeCharUuid && profile.modeWriteValue) {
      const modeChar = await service.getCharacteristic(profile.modeCharUuid)
      await modeChar.writeValue(new Uint8Array(profile.modeWriteValue))
    }

    const dataChar = await service.getCharacteristic(profile.dataCharUuid)
    const value = await dataChar.readValue()

    const decoded =
      profile.id === MI_FLORA_PROFILE.id
        ? decodeMiFlora(value)
        : decodeCustom(value, profile.customFields ?? [])

    return {
      ...decoded,
      deviceName: device.name ?? '不明なデバイス',
      simulated: false,
    }
  } finally {
    server.disconnect()
  }
}

export function simulateReading(): SensorReading {
  return {
    moisturePercent: Math.round(30 + Math.random() * 40),
    temperatureC: Math.round((15 + Math.random() * 10) * 10) / 10,
    ecMScm: Math.round(Math.random() * 200) / 100,
    deviceName: 'シミュレーション(デモ)',
    simulated: true,
  }
}
