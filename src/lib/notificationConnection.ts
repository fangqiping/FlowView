import * as signalR from '@microsoft/signalr'
import { getNotificationHubUrl } from './api'

export interface NotificationConnection {
  on(eventName: string, callback: (...args: unknown[]) => void): void
  start(): Promise<void>
  stop(): Promise<void>
}

export function createNotificationConnection(): NotificationConnection {
  return new signalR.HubConnectionBuilder()
    .withUrl(getNotificationHubUrl())
    .withAutomaticReconnect()
    .build()
}
