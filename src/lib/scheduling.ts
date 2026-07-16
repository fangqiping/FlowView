import type { SchedulePlanItemModel } from '../types'

export interface ResourceScheduleLane {
  key: string
  resourceType: string
  resourceId: string
  items: SchedulePlanItemModel[]
}

export interface TimelineGeometry {
  leftPercent: number
  widthPercent: number
}

export interface ScheduleInterval {
  start: string
  end: string
}

const ZERO_GEOMETRY: TimelineGeometry = { leftPercent: 0, widthPercent: 0 }
const ISO_DATE_TIME_OFFSET_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,7}))?(Z|([+-])(\d{2}):(\d{2}))$/

function parseDate(value: string): number | null {
  const match = ISO_DATE_TIME_OFFSET_PATTERN.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const fraction = match[7]
  const offsetHour = match[10] === undefined ? 0 : Number(match[10])
  const offsetMinute = match[11] === undefined ? 0 : Number(match[11])
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

  if (
    year < 1
    || month < 1
    || month > 12
    || day < 1
    || day > daysInMonth[month - 1]
    || hour > 23
    || minute > 59
    || second > 59
    || offsetHour > 14
    || offsetMinute > 59
    || (offsetHour === 14 && offsetMinute !== 0)
  ) {
    return null
  }

  const parseableValue = fraction && fraction.length > 3
    ? value.replace(`.${fraction}`, `.${fraction.slice(0, 3)}`)
    : value
  const timestamp = Date.parse(parseableValue)
  return Number.isFinite(timestamp) ? timestamp : null
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function escapeLaneKeyComponent(value: string): string {
  return value.replace(/%/g, '%25').replace(/\//g, '%2F')
}

function compareDates(left: string, right: string): number {
  const leftTime = parseDate(left)
  const rightTime = parseDate(right)

  if (leftTime === null) return rightTime === null ? 0 : 1
  if (rightTime === null) return -1
  return leftTime - rightTime
}

function compareScheduleItems(left: SchedulePlanItemModel, right: SchedulePlanItemModel): number {
  return compareDates(left.plannedStart, right.plannedStart)
    || compareDates(left.plannedEnd, right.plannedEnd)
    || left.id - right.id
}

export function groupResourceOccupancies(items: SchedulePlanItemModel[]): ResourceScheduleLane[] {
  const lanesByType = new Map<string, Map<string, ResourceScheduleLane>>()

  for (const item of items) {
    if (item.itemKind !== 1 || !item.resourceType || !item.resourceId) continue

    let lanesById = lanesByType.get(item.resourceType)
    if (!lanesById) {
      lanesById = new Map()
      lanesByType.set(item.resourceType, lanesById)
    }

    let lane = lanesById.get(item.resourceId)
    if (!lane) {
      lane = {
        key: `${escapeLaneKeyComponent(item.resourceType)}/${escapeLaneKeyComponent(item.resourceId)}`,
        resourceType: item.resourceType,
        resourceId: item.resourceId,
        items: [],
      }
      lanesById.set(item.resourceId, lane)
    }

    lane.items.push(item)
  }

  return Array.from(lanesByType.values())
    .flatMap((lanesById) => Array.from(lanesById.values()))
    .map((lane) => ({ ...lane, items: [...lane.items].sort(compareScheduleItems) }))
    .sort((left, right) => compareStrings(left.resourceType, right.resourceType)
      || compareStrings(left.resourceId, right.resourceId))
}

export function getTimelineGeometry(
  start: string,
  end: string,
  horizonStart: string,
  horizonEnd: string,
): TimelineGeometry {
  const startTime = parseDate(start)
  const endTime = parseDate(end)
  const horizonStartTime = parseDate(horizonStart)
  const horizonEndTime = parseDate(horizonEnd)

  if (
    startTime === null
    || endTime === null
    || horizonStartTime === null
    || horizonEndTime === null
    || endTime < startTime
    || horizonEndTime <= horizonStartTime
  ) {
    return { ...ZERO_GEOMETRY }
  }

  const duration = horizonEndTime - horizonStartTime
  const clampedStart = Math.min(Math.max(startTime, horizonStartTime), horizonEndTime)
  const clampedEnd = Math.min(Math.max(endTime, horizonStartTime), horizonEndTime)

  return {
    leftPercent: ((clampedStart - horizonStartTime) / duration) * 100,
    widthPercent: ((clampedEnd - clampedStart) / duration) * 100,
  }
}

export function resolveActualInterval(
  item: SchedulePlanItemModel,
  now: string,
  horizonEnd: string,
): ScheduleInterval | null {
  if (!item.actualStart) return null

  const startTime = parseDate(item.actualStart)
  if (startTime === null) return null

  let end: string
  let endTime: number | null

  if (item.actualEnd !== null) {
    end = item.actualEnd
    endTime = parseDate(end)
  } else {
    const nowTime = parseDate(now)
    const horizonEndTime = parseDate(horizonEnd)
    if (nowTime === null || horizonEndTime === null) return null

    if (nowTime <= horizonEndTime) {
      end = now
      endTime = nowTime
    } else {
      end = horizonEnd
      endTime = horizonEndTime
    }
  }

  if (endTime === null || endTime < startTime) return null
  return { start: item.actualStart, end }
}

export function formatScheduleDeviation(plannedEnd: string, observedEnd?: string | null): string {
  if (!observedEnd) return '--'

  const plannedEndTime = parseDate(plannedEnd)
  const observedEndTime = parseDate(observedEnd)
  if (plannedEndTime === null || observedEndTime === null) return '--'

  const deltaMilliseconds = observedEndTime - plannedEndTime
  if (deltaMilliseconds === 0) return '0s'

  const absoluteSeconds = Math.ceil(Math.abs(deltaMilliseconds) / 1000)
  const hours = Math.floor(absoluteSeconds / 3600)
  const minutes = Math.floor((absoluteSeconds % 3600) / 60)
  const seconds = absoluteSeconds % 60
  const parts: string[] = []

  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0) parts.push(`${seconds}s`)

  return `${deltaMilliseconds > 0 ? '+' : '-'}${parts.join(' ')}`
}

export function isDelayedItem(item: SchedulePlanItemModel, now?: string): boolean {
  if (item.status === 4) return true

  const plannedEndTime = parseDate(item.plannedEnd)
  if (plannedEndTime === null) return false

  if (item.actualEnd !== null) {
    const actualEndTime = parseDate(item.actualEnd)
    return actualEndTime !== null && actualEndTime > plannedEndTime
  }

  if (!item.actualStart || !now || parseDate(item.actualStart) === null) return false

  const nowTime = parseDate(now)
  return nowTime !== null && nowTime > plannedEndTime
}
