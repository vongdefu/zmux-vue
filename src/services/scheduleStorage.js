const SCHEDULE_KEY = 'zmux-schedule-v3'

/* ========== 工具函数 ========== */

function fmtMMDD(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${m}/${d}`
}

function mondayOfDate(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const offset = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + offset)
  return d
}

/**
 * 找到某年的第一个周一。
 * 例如 2025-01-01 是周三 → 第一个周一 = 2025-01-06
 */
function firstMondayOfYear(year) {
  const jan1 = new Date(year, 0, 1)
  const day = jan1.getDay()
  if (day === 1) return jan1
  const offset = day === 0 ? 1 : 8 - day
  return new Date(year, 0, 1 + offset)
}

/**
 * 找到某年的最后一个周一（只要周一还在本年度内）。
 * 例如 2022-12-31 是周六 → 最后一个周一 = 2022-12-26
 */
function lastMondayOfYear(year) {
  const dec31 = new Date(year, 11, 31)
  const day = dec31.getDay()
  const offset = day === 0 ? -6 : 1 - day
  return new Date(year, 11, 31 + offset)
}

/**
 * 根据周一日期和当年第一个周一，生成周信息。
 * 周数 = 距离第一个周一的偏移 / 7 + 1
 */
function weekInfoForMonday(monday, firstMonday) {
  const diffDays = Math.round((monday.getTime() - firstMonday.getTime()) / 86400000)
  const weekNum = Math.floor(diffDays / 7) + 1

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const year = monday.getFullYear()

  return {
    id: `${year}-W${String(weekNum).padStart(2, '0')}`,
    monday: monday.toISOString().slice(0, 10),
    label: `第 ${weekNum} 周（${fmtMMDD(monday)}-${fmtMMDD(sunday)}）`,
    start: fmtMMDD(monday),
    end: fmtMMDD(sunday),
    weekNum,
  }
}

/**
 * 兼容旧 API：根据任意日期返回 ISO 8601 周信息（保留给可能的外部调用）。
 * 新代码请使用 firstMondayOfYear + weekInfoForMonday。
 */
export function weekInfo(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const monOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + monOffset)

  const thursday = new Date(monday)
  thursday.setDate(monday.getDate() + 3)
  const isoYear = thursday.getFullYear()

  const jan4 = new Date(isoYear, 0, 4)
  const jan4Day = jan4.getDay()
  const jan4Mon = new Date(jan4)
  jan4Mon.setDate(jan4.getDate() + (jan4Day === 0 ? -6 : 1 - jan4Day))

  const diffDays = Math.round((monday.getTime() - jan4Mon.getTime()) / 86400000)
  const weekNum = Math.floor(diffDays / 7) + 1

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  return {
    id: `${isoYear}-W${String(weekNum).padStart(2, '0')}`,
    monday: monday.toISOString().slice(0, 10),
    label: `第 ${weekNum} 周（${fmtMMDD(monday)}-${fmtMMDD(sunday)}）`,
    start: fmtMMDD(monday),
    end: fmtMMDD(sunday),
    sunday: sunday.toISOString().slice(0, 10),
    weekNum,
  }
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

export function createTask(text) {
  return { id: uid(), text: text.trim(), completed: false, children: [] }
}

/* ========== 持久化 ========== */

export function loadSchedule() {
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) || {}
  } catch { return {} }
}

export function saveSchedule(schedule) {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule))
}

/* ========== 周管理 ========== */

/**
 * 补全某个年份从第一个周一到年末（或今天）的所有周。
 *
 * 规则：
 * - 第 1 周 = 当年第一个周一所在的那一周
 * - 只要周一落在本年度，就算本年的周（允许跨年）
 * - 过去年份：生成全部周并锁定
 * - 当前年份：只生成到本周，本周不锁定
 * - 已有周保留数据并修正锁定状态
 */
export function initYearSchedule(schedule, year) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const currentYear = today.getFullYear()

  const firstMonday = firstMondayOfYear(year)
  let lastMonday = lastMondayOfYear(year)

  // 当前年份：只生成到本周
  if (year === currentYear) {
    const todayMonday = mondayOfDate(today)
    // 如果今天还没到今年的第一个周一，则不生成任何周
    if (todayMonday < firstMonday) {
      if (!schedule[year]) schedule[year] = { weeks: [] }
      return schedule[year]
    }
    if (todayMonday < lastMonday) lastMonday = todayMonday
  }

  if (!schedule[year]) schedule[year] = { weeks: [] }
  const yearData = schedule[year]

  const todayMondayStr = mondayOfDate(today).toISOString().slice(0, 10)
  const seen = new Set(yearData.weeks.map(w => w.monday))

  const cursor = new Date(firstMonday)
  while (cursor <= lastMonday) {
    const info = weekInfoForMonday(new Date(cursor), firstMonday)

    if (!seen.has(info.monday)) {
      seen.add(info.monday)
      // 过去年份全部锁定；今年本周之前的周锁定，本周不锁定
      const isPast = year < currentYear || info.monday < todayMondayStr
      yearData.weeks.push({
        id: info.id,
        monday: info.monday,
        label: info.label,
        start: info.start,
        end: info.end,
        locked: isPast,
        tasks: [],
        report: { summary: '' },
      })
    } else {
      // 修正已有周的锁定状态
      const existing = yearData.weeks.find(w => w.monday === info.monday)
      if (existing) {
        existing.locked = year < currentYear || info.monday < todayMondayStr
      }
    }
    cursor.setDate(cursor.getDate() + 7)
  }

  // 按周一日期倒序排列（最近的在前）
  yearData.weeks.sort((a, b) => b.monday.localeCompare(a.monday))

  return yearData
}

/** 确保当前周存在（周一自动生成新周 + 迁移未完成任务） */
export function ensureCurrentWeek(schedule, year) {
  const yearData = schedule[year]
  if (!yearData) return initYearSchedule(schedule, year)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const firstMonday = firstMondayOfYear(year)
  const todayMonday = mondayOfDate(today)

  // 如果今天还没到今年的第一个周一，当前周属于上一年
  if (todayMonday < firstMonday) return yearData

  const info = weekInfoForMonday(todayMonday, firstMonday)

  const existing = yearData.weeks.find(w => w.monday === info.monday)
  if (existing) {
    existing.locked = false
    return yearData
  }

  // 上一周（锁定并迁移未完成任务）
  const prevMonday = new Date(todayMonday)
  prevMonday.setDate(prevMonday.getDate() - 7)
  const prevInfo = weekInfoForMonday(prevMonday, firstMonday)
  const prevWeek = yearData.weeks.find(w => w.monday === prevInfo.monday)

  const newWeek = {
    id: info.id,
    monday: info.monday,
    label: info.label,
    start: info.start,
    end: info.end,
    locked: false,
    tasks: [],
    report: { summary: '' },
  }

  if (prevWeek) {
    prevWeek.locked = true
    const incomplete = collectIncomplete(prevWeek.tasks)
    if (incomplete.length) newWeek.tasks = incomplete
  }

  yearData.weeks.push(newWeek)
  yearData.weeks.sort((a, b) => b.monday.localeCompare(a.monday))
  return yearData
}

function collectIncomplete(tasks) {
  return tasks
    .filter(t => !t.completed)
    .map(t => ({
      ...createTask(t.text),
      children: t.children ? collectIncomplete(t.children) : [],
    }))
}

/* ========== 任务树操作 ========== */

function findById(tasks, id) {
  for (const t of tasks) {
    if (t.id === id) return t
    if (t.children?.length) {
      const found = findById(t.children, id)
      if (found) return found
    }
  }
  return null
}

function removeById(tasks, id) {
  const idx = tasks.findIndex(t => t.id === id)
  if (idx >= 0) { tasks.splice(idx, 1); return true }
  for (const t of tasks) {
    if (t.children?.length && removeById(t.children, id)) return true
  }
  return false
}

export function addTaskToWeek(week, parentId, text) {
  const task = createTask(text)
  if (!parentId) {
    week.tasks.push(task)
  } else {
    const parent = findById(week.tasks, parentId)
    if (parent) {
      if (!parent.children) parent.children = []
      parent.children.push(task)
    }
  }
  return task
}

export function toggleTaskInWeek(week, taskId) {
  const task = findById(week.tasks, taskId)
  if (task) task.completed = !task.completed
}

export function deleteTaskInWeek(week, taskId) {
  removeById(week.tasks, taskId)
}
