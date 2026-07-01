const SCHEDULE_KEY = 'zmux-schedule-v3'

/* ========== 工具函数 ========== */

function fmtMMDD(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${m}/${d}`
}

/**
 * ISO 8601 周历。
 * 周一为每周第一天；ISO 年份由该周周四所在的日历年决定；
 * 第 1 周 = 包含 1 月 4 日的那一周。
 */
export function weekInfo(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const monOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + monOffset)

  // ISO 年份 = 该周周四所在的日历年
  const thursday = new Date(monday)
  thursday.setDate(monday.getDate() + 3)
  const isoYear = thursday.getFullYear()

  // 1 月 4 日所在周的周一
  const jan4 = new Date(isoYear, 0, 4)
  const jan4Day = jan4.getDay()
  const jan4Mon = new Date(jan4)
  jan4Mon.setDate(jan4.getDate() + (jan4Day === 0 ? -6 : 1 - jan4Day))

  const diffDays = Math.round((monday.getTime() - jan4Mon.getTime()) / 86400000)
  const weekNum = Math.floor(diffDays / 7) + 1

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const mondayStr = monday.toISOString().slice(0, 10)

  return {
    id: `${isoYear}-W${String(weekNum).padStart(2, '0')}`,
    monday: mondayStr,          // 唯一键，用于去重
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
 * 补全某个年份从 1 月 1 日到年末（或今天）的所有周。
 * - 已有周保留数据、修正锁定状态
 * - 缺失周追加
 * - 按 monday 字段去重
 */
export function initYearSchedule(schedule, year) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const currentYear = today.getFullYear()

  const endDate = year < currentYear
    ? new Date(year, 11, 31)
    : today

  if (!schedule[year]) schedule[year] = { weeks: [] }
  const yearData = schedule[year]
  const thisMonday = weekInfo(today).monday

  const cursor = new Date(year, 0, 1)
  const seen = new Set(yearData.weeks.map(w => w.monday))

  while (cursor <= endDate) {
    const info = weekInfo(cursor)

    if (!seen.has(info.monday)) {
      seen.add(info.monday)
      // 过去年份 → 全部锁定；今年 → 本周及未来不锁定
      const isPast = year < currentYear || info.monday < thisMonday
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
        existing.locked = year < currentYear || info.monday < thisMonday
      }
    }
    cursor.setDate(cursor.getDate() + 7)
  }

  return yearData
}

/** 确保当前周存在（周一自动生成新周 + 迁移未完成任务） */
export function ensureCurrentWeek(schedule, year) {
  const yearData = schedule[year]
  if (!yearData) return initYearSchedule(schedule, year)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const info = weekInfo(today)

  const existing = yearData.weeks.find(w => w.monday === info.monday)
  if (existing) {
    existing.locked = false
    return yearData
  }

  // 上一周
  const prevMon = new Date(today)
  const day = today.getDay()
  const offset = day === 0 ? -6 : 1 - day
  prevMon.setDate(today.getDate() + offset - 7)
  const prevInfo = weekInfo(prevMon)
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
