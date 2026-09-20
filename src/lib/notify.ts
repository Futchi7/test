import type { Planting, ReadinessResult } from '../types'
import { todayIso } from './gdd'

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission(): NotificationPermission {
  return notificationsSupported() ? Notification.permission : 'denied'
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied'
  return Notification.requestPermission()
}

/**
 * アプリを開いた際に、その日まだ通知していなければローカル通知を出す。
 * 真のプッシュ通知(アプリを閉じていても届く)にはサーバー側の仕組みが必要なため、
 * このMVPでは「アプリを開いたタイミングでの気付き」に留めています。
 */
export function maybeNotifyReadiness(planting: Planting, readiness: ReadinessResult): void {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  if (readiness.status !== 'approaching' && readiness.status !== 'ready') return

  const key = `imohori-notified:${planting.id}:${todayIso()}`
  if (localStorage.getItem(key)) return
  localStorage.setItem(key, '1')

  const body =
    readiness.status === 'ready'
      ? `${planting.plotName} が収穫適期の目安に達しました。試し掘りで確認しましょう。`
      : `${planting.plotName} がもうすぐ収穫適期です。そろそろ試し掘りの準備を。`

  new Notification('いも掘りナビ', { body })
}
