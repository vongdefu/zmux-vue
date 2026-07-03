# Calendar Management Feature — Design Spec

**Date**: 2026-07-03  
**Status**: approved

## Overview

Add a new "日历管理" (Calendar Management) page to the app, implementing core Apple Calendar functionality as a client-side SPA with localStorage persistence. The feature coexists with the existing ScheduleView — both are accessible from the home page module list. Navigation entry is added to HomeView's module list, not the TabBar.

## Scope

Complete edition (方案 C): month/week/day views, event CRUD, multiple calendars with color coding, all-day events, recurring events, browser notifications, event search, .ics import/export, week start day customization, manual invitee entry, attachment links.

## Non-Goals

- No iCloud/Google account sync (needs backend/OAuth)
- No Siri/natural language input (needs Apple platform APIs)
- No Maps/travel time integration
- No email invitation sending (RSVP is manual-only)
- No push notifications (needs service worker + backend)
- Does NOT modify or remove existing ScheduleView

## Component Architecture

### New Files

```
src/components/CalendarView.vue         # Main calendar page — view switcher, search bar, navigation
src/components/calendar/
├── MonthGrid.vue                       # 6×7 month grid with event dots
├── WeekView.vue                        # 7-column time-axis week view
├── DayView.vue                         # Single-column time-axis day view
├── EventSheet.vue                      # Bottom-sheet for event create/edit
├── CalendarList.vue                    # Multi-calendar toggle + color management
└── MiniEventCard.vue                   # Tiny event label inside month grid cells
src/services/calendarStorage.js         # Event CRUD + localStorage with key "zmux-calendar-v1"
```

### Modified Files

```
src/App.vue                             # Add CalendarView conditional render + import
src/components/HomeView.vue             # Add "日历管理" entry to modules list
```

### Navigation

- HomeView module list → `emit('navigate', 'calendar')` → App.vue sets `currentView = 'calendar'`
- CalendarView has a back button → `emit('back')` → App.vue sets `currentView = 'home'`

## Data Model

### Calendar

```js
{
  id: string,           // "cal-{timestamp}-{random}"
  name: string,         // e.g., "工作", "个人"
  color: string,        // hex color
}
```

### Event

```js
{
  id: string,                  // "evt-{timestamp}-{random}"
  calendarId: string,          // ref to calendar.id
  title: string,
  location: string,            // optional
  notes: string,               // optional
  start: string,               // ISO 8601 e.g. "2026-07-03T09:00:00"
  end: string,                 // ISO 8601
  allDay: boolean,
  recurrence: null | {
    type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom',
    interval: number,           // e.g., 2 = every other week
    daysOfWeek: number[],       // 0=Sun..6=Sat, for weekly recurrence
    endDate: string | null,     // ISO date string, null = forever
  },
  invitees: string[],           // plain text names
  attachments: string[],        // URLs
  alerts: { minutes: number }[], // e.g., [{minutes:15}, {minutes:60}]
}
```

### Persistence Structure (localStorage key: `zmux-calendar-v1`)

```js
{
  calendars: [ Calendar ],
  events: [ Event ],
  settings: {
    weekStartsOn: 1,          // 0=Sunday, 1=Monday
    defaultCalendarId: string,
  }
}
```

### Default Calendars (created on first launch)

| Name | Color |
|---|---|
| 工作 | `#007AFF` (blue) |
| 个人 | `#34C759` (green) |
| 家庭 | `#FF9500` (orange) |
| 重要 | `#FF3B30` (red) |

## Views

### Month View (default)

- Month title header with `< 2026年7月 >` navigation arrows
- 6-row × 7-column grid
- Day numbers in top-left corner, today highlighted with `--accent` red circle
- Each cell shows up to 3 MiniEventCards (colored dot + truncated title)
- "+\<N\> 更多" indicator when >3 events
- Tap date → switch to Day View for that date
- Tap event card → open EventSheet in edit mode
- Top-right "+" button → new event (pre-fills selected date)
- Bottom "今天" button → scroll to today
- Swipe left/right → change month (stretch goal; v1 uses arrow buttons only)

### Week View

- 7-column time-axis layout, one column per day
- Day header row with date + weekday, today highlighted
- Left time scale column (00:00 - 23:00), one row per hour
- Events rendered as colored blocks at their time position, height proportional to duration
- All-day events in a top strip above the time grid
- Tap empty time slot → new event (auto-fills time)
- Tap event block → edit event
- Horizontal scroll if content overflows

### Day View

- Single-column time-axis, same as week view but one day only
- Date header with `< 2026年7月3日 周五 >` + navigation arrows
- All-day events strip at top
- Time scale 00:00-23:00
- Same interaction as week view

### View Switcher

- iOS segmented control style: three buttons [月 | 周 | 日]
- Default: 月 (month)
- Positioned below the top bar

## EventSheet (Bottom Sheet)

iOS-style bottom sheet for create/edit. Fields in order:

1. **Title** — text input, auto-focus
2. **All-Day Toggle** — switch, hides time pickers when on
3. **Start Date/Time** — inline picker (date-only when all-day)
4. **End Date/Time** — inline picker
5. **Repeat** — pick list: 不重复 / 每天 / 每周 / 每月 / 每年 / 自定义
6. **Calendar** — pick list showing color dot + calendar name
7. **Location** — text input
8. **Invitees** — text input, add multiple, shows as chips
9. **Alerts** — multi-select: 无 / 开始时 / 15分钟前 / 1小时前 / 1天前 / 自定义
10. **Notes** — textarea
11. **Attachments** — URL input, add multiple
12. **Delete Event** — red text button (edit mode only)

Header: "取消" (left, dismiss) | "新建事件" or "编辑事件" (center) | "保存" (right)

Dismiss via: Cancel button, save button (after validation), or overlay tap outside sheet (v1). Swipe-down gesture is stretch goal.

## CalendarList

- Full page or sheet listing all calendars
- Each row: color circle (24px) + name + visibility toggle switch
- Bottom "添加日历" button → inline name input + color picker (8 preset colors)
- Swipe left to delete (min 1 calendar remaining)
- Tap row to edit name/color (edit mode only, not on toggle)

## Other Features

### Event Search
- Search bar at top of CalendarView
- Filters events by title substring
- Results shown as list with date + calendar color indicator
- Tap result → navigate to that date in appropriate view

### .ics Import/Export
- **Export**: Button in CalendarList or settings area. Serializes all events as .ics (iCalendar RFC 5545 format). Triggers file download via Blob + `<a>` click.
- **Import**: File input accepting .ics files. Parses basic .ics fields (VEVENT: SUMMARY, DTSTART, DTEND, DESCRIPTION, LOCATION, RRULE). Merges into local events.

### Week Start Day
- Setting in CalendarList: toggle between 周一 and 周日
- Affects MonthGrid and WeekView layouts

### Browser Notifications
- On event creation with alerts, request Notification permission
- Calculate alert time based on event start - alert.minutes
- Use `setTimeout` or check on interval to trigger `new Notification(title, {body})`
- Handle: permission denied gracefully (alerts stored but not fired)

### Recurring Events
- Expand recurrence when rendering: for each recurring event, generate instances up to `endDate` or 1 year from now
- Generated instances get computed IDs like `{eventId}-{dateStr}`
- Editing a recurring instance prompts: "仅此事件" or "所有重复事件"

## Data Flow

```
calendarStorage.js
  ├── loadCalendarData() → { calendars, events, settings }
  ├── saveCalendarData(data)
  ├── addEvent(event) / updateEvent(id, patch) / deleteEvent(id)
  ├── addCalendar(cal) / updateCalendar(id, patch) / deleteCalendar(id)
  ├── updateSettings(patch)
  ├── expandRecurringEvents(events, fromDate, toDate) → event instances
  ├── exportICS() → string
  └── importICS(icsString) → parsed events
```

CalendarView loads data on mount, passes expanded event instances to child views.
All mutations go through calendarStorage functions → save to localStorage.

## Design Tokens

- All styles use existing `var(--*)` tokens from `tokens.css`
- Calendar colors: 8 presets (blue, green, orange, red, purple, teal, pink, indigo) — stored as hex, used inline
- New component-specific CSS scoped within each `.vue` file

## Success Criteria

1. Month view renders 6×7 grid with correct dates and event dots
2. Week and Day views show time-axis with events positioned correctly
3. Create/edit/delete events via EventSheet, persisted across reload
4. Multiple calendars with color coding, toggle visibility works
5. Recurring events expand correctly (daily, weekly, monthly, yearly)
6. All-day events render in the top strip, not on time grid
7. .ics export generates valid iCalendar file; import parses basic fields
8. Browser notifications fire at configured alert times
9. Event search finds events by title
10. Week start day setting affects month + week layouts
11. Existing ScheduleView is untouched and still works
12. Build passes with zero errors
