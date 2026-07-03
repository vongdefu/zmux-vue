// src/services/calendarStorage.js
const STORAGE_KEY = 'zmux-calendar-v1'

export const CALENDAR_COLORS = [
  '#007AFF', '#34C759', '#FF9500', '#FF3B30',
  '#AF52DE', '#5AC8FA', '#FF6482', '#5856D6',
]

export const DEFAULT_CALENDARS = [
  { id: 'cal-default-work', name: '工作', color: '#007AFF' },
  { id: 'cal-default-personal', name: '个人', color: '#34C759' },
  { id: 'cal-default-family', name: '家庭', color: '#FF9500' },
  { id: 'cal-default-important', name: '重要', color: '#FF3B30' },
]

function getDefaultData() {
  return {
    calendars: DEFAULT_CALENDARS.map(c => ({ ...c })),
    events: [],
    settings: {
      weekStartsOn: 1,
      defaultCalendarId: 'cal-default-work',
    },
  }
}

export function loadCalendarData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return getDefaultData()
    const data = JSON.parse(raw)
    return {
      calendars: data.calendars || [],
      events: data.events || [],
      settings: { ...getDefaultData().settings, ...data.settings },
    }
  } catch {
    return getDefaultData()
  }
}

export function saveCalendarData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function generateUID(prefix = 'evt') {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

// --- Calendar CRUD ---

export function addCalendar(data, cal) {
  data.calendars.push(cal)
  saveCalendarData(data)
}

export function updateCalendar(data, id, patch) {
  const cal = data.calendars.find(c => c.id === id)
  if (cal) Object.assign(cal, patch)
  saveCalendarData(data)
}

export function deleteCalendar(data, id) {
  if (data.calendars.length <= 1) return false
  data.calendars = data.calendars.filter(c => c.id !== id)
  // Reassign events from deleted calendar to first remaining
  const fallbackId = data.calendars[0].id
  data.events.forEach(e => { if (e.calendarId === id) e.calendarId = fallbackId })
  saveCalendarData(data)
  return true
}

// --- Event CRUD ---

export function addEvent(data, event) {
  data.events.push(event)
  saveCalendarData(data)
}

export function updateEvent(data, id, patch) {
  const idx = data.events.findIndex(e => e.id === id)
  if (idx >= 0) Object.assign(data.events[idx], patch)
  saveCalendarData(data)
}

export function deleteEvent(data, id) {
  data.events = data.events.filter(e => e.id !== id && !e.id.startsWith(id + '-'))
  saveCalendarData(data)
}

// --- Query ---

export function getEventsForDate(data, dateStr) {
  const instances = expandRecurringEvents(data, dateStr, dateStr)
  return instances.filter(e => {
    const startDay = e.start.slice(0, 10)
    const endDay = e.end.slice(0, 10)
    return dateStr >= startDay && dateStr <= endDay
  }).sort((a, b) => a.start.localeCompare(b.start))
}

function dateKey(d) {
  if (typeof d === 'string') return d.slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return dateKey(d)
}

function dayOfWeek(dateStr) {
  return new Date(dateStr + 'T00:00:00').getDay()
}

// --- Recurring Event Expansion ---

export function expandRecurringEvents(data, fromStr, toStr) {
  const result = []
  for (const event of data.events) {
    if (!event.recurrence) {
      result.push(event)
      continue
    }
    const rec = event.recurrence
    const endLimit = rec.endDate ? new Date(rec.endDate + 'T23:59:59') : new Date(Date.now() + 365 * 86400000)
    const toLimit = new Date(toStr + 'T23:59:59')
    const limit = endLimit < toLimit ? endLimit : toLimit

    let cursor = new Date(event.start.slice(0, 10) + 'T00:00:00')
    const fromDate = new Date(fromStr + 'T00:00:00')

    while (cursor <= limit) {
      const curStr = dateKey(cursor)
      if (cursor >= fromDate) {
        const origStart = event.start.slice(11)
        const origEnd = event.end.slice(11)
        result.push({
          ...event,
          id: `${event.id}-${curStr}`,
          _originalId: event.id,
          start: `${curStr}${origStart ? 'T' + origStart : ''}`,
          end: `${curStr}${origEnd ? 'T' + origEnd : ''}`,
        })
      }

      // Advance cursor based on recurrence type
      switch (rec.type) {
        case 'daily':
          cursor.setDate(cursor.getDate() + (rec.interval || 1))
          break
        case 'weekly':
          cursor.setDate(cursor.getDate() + 7 * (rec.interval || 1))
          break
        case 'monthly':
          cursor.setMonth(cursor.getMonth() + (rec.interval || 1))
          break
        case 'yearly':
          cursor.setFullYear(cursor.getFullYear() + (rec.interval || 1))
          break
        default:
          cursor.setDate(cursor.getDate() + 1)
      }
    }
  }
  return result
}

// --- ICS Export ---

function escapeICS(text) {
  return (text || '').replace(/[\\;,]/g, '\\$&').replace(/\n/g, '\\n')
}

function fmtICSDate(iso) {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export function exportICS(data) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//zmux//Calendar//CN']
  for (const event of data.events) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${event.id}`)
    lines.push(`DTSTART:${fmtICSDate(event.start)}`)
    lines.push(`DTEND:${fmtICSDate(event.end)}`)
    lines.push(`SUMMARY:${escapeICS(event.title)}`)
    if (event.location) lines.push(`LOCATION:${escapeICS(event.location)}`)
    if (event.notes) lines.push(`DESCRIPTION:${escapeICS(event.notes)}`)
    if (event.recurrence) {
      const r = event.recurrence
      const freq = r.type.toUpperCase().slice(0, 2) + r.type.slice(1) // daily -> DAILY
      lines.push(`RRULE:FREQ=${freq};INTERVAL=${r.interval || 1}`)
    }
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

// --- ICS Import (basic) ---

export function importICS(data, icsString) {
  const events = []
  const blocks = icsString.split('BEGIN:VEVENT')
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0]
    const get = (prop) => {
      const re = new RegExp(`^${prop}[;:](.+)$`, 'im')
      const m = block.match(re)
      return m ? m[1].trim().replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n') : ''
    }
    const dtStart = get('DTSTART')
    const dtEnd = get('DTEND')
    if (!dtStart || !get('SUMMARY')) continue

    const parseDT = (s) => {
      if (s.length === 8) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`
      return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(9,11)}:${s.slice(11,13)}:${s.slice(13,15)}`
    }

    events.push({
      id: generateUID(),
      calendarId: data.calendars[0]?.id || 'cal-default-work',
      title: get('SUMMARY'),
      location: get('LOCATION'),
      notes: get('DESCRIPTION'),
      start: parseDT(dtStart),
      end: parseDT(dtEnd || dtStart),
      allDay: dtStart.length === 8,
      recurrence: null,
      invitees: [],
      attachments: [],
      alerts: [],
    })
  }
  for (const e of events) data.events.push(e)
  saveCalendarData(data)
  return events.length
}
