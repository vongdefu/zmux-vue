const STORAGE_KEY = 'zmux-accounting-v1'

export const DEFAULT_CATEGORIES = [
  { name: '餐饮', icon: '🍽️', defaultBudget: 2000 },
  { name: '交通', icon: '🚗', defaultBudget: 500 },
  { name: '购物', icon: '🛍️', defaultBudget: 1000 },
  { name: '娱乐', icon: '🎮', defaultBudget: 500 },
  { name: '居住', icon: '🏠', defaultBudget: 3000 },
  { name: '医疗', icon: '💊', defaultBudget: 500 },
  { name: '教育', icon: '📚', defaultBudget: 500 },
  { name: '其他', icon: '📌', defaultBudget: 500 },
]

function defaultData() {
  const categories = DEFAULT_CATEGORIES.map(c => c.name)
  const budgets = {}
  DEFAULT_CATEGORIES.forEach(c => { budgets[c.name] = c.defaultBudget })
  return { categories, budgets, records: [] }
}

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultData()
    const data = JSON.parse(raw)
    return {
      categories: Array.isArray(data.categories) ? data.categories : defaultData().categories,
      budgets: data.budgets && typeof data.budgets === 'object' ? data.budgets : defaultData().budgets,
      records: Array.isArray(data.records) ? data.records : [],
    }
  } catch {
    return defaultData()
  }
}

export function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function createRecord(category, amount, date, note = '') {
  return {
    id: `rec-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    category,
    amount: Math.round(amount * 100) / 100,
    date,
    note: note.trim(),
  }
}
