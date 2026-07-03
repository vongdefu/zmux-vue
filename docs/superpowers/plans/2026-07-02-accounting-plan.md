# 记账功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a monthly budget-based accounting feature with category budgets, expense records, and progress tracking.

**Architecture:** Follows existing feature pattern — `AccountingView.vue` + `accountingStorage.js` with `localStorage` key `zmux-accounting-v1`. Component self-manages state, imports `usePlayerStore()` for `showToast`. Navigation via `currentView` ref + TabBar + HomeView grid.

**Tech Stack:** Vue 3 Composition API (`<script setup>`), CSS custom properties (design tokens), `localStorage`

## Global Constraints

- All UI text in Chinese
- Accent color: `var(--accent)` (`#ec4141` Netease red)
- Spacing/radii: use design tokens (`var(--radius-md)`, `var(--space-md)`, etc.)
- Glass effect: use `.glass` utility class where appropriate
- Storage key: `zmux-accounting-v1`
- Component receives no props; imports `usePlayerStore()` directly for `showToast`
- Mobile-first, max-width 430px phone shell

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/services/accountingStorage.js` | Create | CRUD for categories, budgets, records; localStorage persistence |
| `src/components/AccountingView.vue` | Create | Full UI: month switcher, budget cards, record list, add-record sheet, budget settings sheet |
| `src/components/TabBar.vue` | Modify | Add 5th tab (记账) |
| `src/components/HomeView.vue` | Modify | Add accounting module card to grid |
| `src/App.vue` | Modify | Add `'accounting'` view routing |

---

### Task 1: accountingStorage.js — Data Layer

**Files:**
- Create: `src/services/accountingStorage.js`

**Interfaces:**
- Produces:
  ```js
  // Constants
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

  // Types (for reference):
  // Record: { id: string, category: string, amount: number, date: 'YYYY-MM-DD', note: string }
  // Data: { categories: string[], budgets: Record<string, number>, records: Record[] }

  export function loadData(): Data
  export function saveData(data: Data): void
  export function monthKey(year: number, month: number): string  // 'YYYY-MM'
  export function createRecord(category: string, amount: number, date: string, note?: string): Record
  ```

- [ ] **Step 1: Write the file**

```js
// src/services/accountingStorage.js
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
```

- [ ] **Step 2: Verify no syntax errors**

```bash
node -e "import('./src/services/accountingStorage.js').then(m => console.log(Object.keys(m)))"
```
Expected: `[ 'DEFAULT_CATEGORIES', 'loadData', 'saveData', 'monthKey', 'createRecord' ]`

- [ ] **Step 3: Commit**

```bash
git add src/services/accountingStorage.js
git commit -m "feat: add accountingStorage.js data layer"
```

---

### Task 2: AccountingView.vue — Main Component

**Files:**
- Create: `src/components/AccountingView.vue`

**Interfaces:**
- Consumes: `loadData`, `saveData`, `DEFAULT_CATEGORIES`, `monthKey`, `createRecord` from `accountingStorage.js`
- Consumes: `usePlayerStore` from `../stores/playerStore` (for `showToast`)
- Emits: `back`

- [ ] **Step 1: Write the component**

```vue
<script setup>
import { computed, ref } from 'vue'
import {
  loadData,
  saveData,
  DEFAULT_CATEGORIES,
  monthKey,
  createRecord,
} from '../services/accountingStorage'
import { usePlayerStore } from '../stores/playerStore'

const emit = defineEmits(['back'])
const store = usePlayerStore()

// ---- State ----
const data = ref(loadData())
const now = new Date()
const currentYear = ref(now.getFullYear())
const currentMonth = ref(now.getMonth() + 1) // 1-based
const showAddSheet = ref(false)
const showBudgetSheet = ref(false)

// Add form
const addCategory = ref(DEFAULT_CATEGORIES[0].name)
const addAmount = ref('')
const addDate = ref(new Date().toISOString().slice(0, 10))
const addNote = ref('')

// ---- Computed ----
const categoryMeta = computed(() => {
  const map = {}
  DEFAULT_CATEGORIES.forEach(c => { map[c.name] = c })
  return map
})

const currentKey = computed(() => monthKey(currentYear.value, currentMonth.value))

const monthRecords = computed(() =>
  data.value.records.filter(r => r.date.startsWith(currentKey.value))
)

const categorySpending = computed(() => {
  const totals = {}
  data.value.categories.forEach(c => { totals[c] = 0 })
  monthRecords.value.forEach(r => {
    if (totals[r.category] !== undefined) totals[r.category] += r.amount
  })
  return totals
})

const totalSpent = computed(() =>
  Object.values(categorySpending.value).reduce((a, b) => a + b, 0)
)

const totalBudget = computed(() =>
  data.value.categories.reduce((sum, c) => sum + (data.value.budgets[c] || 0), 0)
)

// ---- Methods ----
function prevMonth() {
  if (currentMonth.value === 1) {
    currentMonth.value = 12
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

function nextMonth() {
  if (currentMonth.value === 12) {
    currentMonth.value = 1
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

function openAddSheet() {
  addCategory.value = data.value.categories[0] || DEFAULT_CATEGORIES[0].name
  addAmount.value = ''
  addDate.value = new Date().toISOString().slice(0, 10)
  addNote.value = ''
  showAddSheet.value = true
}

function submitRecord() {
  const amount = parseFloat(addAmount.value)
  if (!amount || amount <= 0) {
    store.showToast('请输入有效金额')
    return
  }
  const record = createRecord(addCategory.value, amount, addDate.value, addNote.value)
  data.value.records.push(record)
  saveData(data.value)
  showAddSheet.value = false
  store.showToast('已记录')
}

function deleteRecord(id) {
  const idx = data.value.records.findIndex(r => r.id === id)
  if (idx >= 0) {
    data.value.records.splice(idx, 1)
    saveData(data.value)
    store.showToast('已删除')
  }
}

function updateBudget(category, value) {
  const budget = parseFloat(value) || 0
  data.value.budgets[category] = Math.max(0, budget)
  saveData(data.value)
}

function budgetPercent(category) {
  const budget = data.value.budgets[category] || 0
  if (!budget) return 0
  return Math.min((categorySpending.value[category] || 0) / budget * 100, 100)
}

function formatMoney(n) {
  return n.toFixed(2)
}
</script>

<template>
  <div class="accounting-view">
    <!-- 顶栏 -->
    <header class="acct-top-bar">
      <button class="acct-back" @click="emit('back')">←</button>
      <h1>记账</h1>
      <button class="acct-budget-btn" @click="showBudgetSheet = true">预算</button>
    </header>

    <!-- 月份切换 -->
    <div class="acct-month-bar">
      <button @click="prevMonth">←</button>
      <span>{{ currentYear }}年{{ currentMonth }}月</span>
      <button @click="nextMonth">→</button>
    </div>

    <div class="acct-content">
      <!-- 总览条 -->
      <div class="acct-summary">
        <div class="summary-item">
          <span class="summary-label">本月支出</span>
          <span class="summary-value">¥{{ formatMoney(totalSpent) }}</span>
        </div>
        <div class="summary-divider" />
        <div class="summary-item">
          <span class="summary-label">预算剩余</span>
          <span class="summary-value" :class="{ over: totalSpent > totalBudget }">
            ¥{{ formatMoney(Math.max(0, totalBudget - totalSpent)) }}
          </span>
        </div>
      </div>

      <!-- 分类预算卡片 -->
      <div class="acct-category-grid">
        <div
          v-for="cat in data.categories"
          :key="cat"
          class="acct-cat-card"
          :class="{ over: categorySpending[cat] > (data.budgets[cat] || 0) }"
        >
          <div class="cat-card-top">
            <span class="cat-icon">{{ categoryMeta[cat]?.icon || '📌' }}</span>
            <span class="cat-name">{{ cat }}</span>
          </div>
          <div class="cat-card-amount">
            <span class="cat-spent">¥{{ formatMoney(categorySpending[cat] || 0) }}</span>
            <span class="cat-budget">/ ¥{{ formatMoney(data.budgets[cat] || 0) }}</span>
          </div>
          <div class="cat-progress">
            <div
              class="cat-progress-fill"
              :style="{ width: budgetPercent(cat) + '%' }"
            />
          </div>
        </div>
      </div>

      <!-- 本月记录列表 -->
      <div class="acct-records">
        <h3>支出明细</h3>
        <div v-if="!monthRecords.length" class="empty-records">
          本月暂无支出记录
        </div>
        <div
          v-for="rec in [...monthRecords].reverse()"
          :key="rec.id"
          class="acct-record-row"
        >
          <div class="rec-left">
            <span class="rec-cat-tag">{{ rec.category }}</span>
            <div class="rec-info">
              <span class="rec-date">{{ rec.date.slice(5) }}</span>
              <span v-if="rec.note" class="rec-note">{{ rec.note }}</span>
            </div>
          </div>
          <div class="rec-right">
            <span class="rec-amount">-¥{{ formatMoney(rec.amount) }}</span>
            <button class="rec-del" @click="deleteRecord(rec.id)">×</button>
          </div>
        </div>
      </div>
    </div>

    <!-- FAB -->
    <button class="acct-fab" @click="openAddSheet">+</button>

    <!-- ===== 添加支出 Sheet ===== -->
    <Transition name="sheet">
      <div v-if="showAddSheet" class="sheet-overlay" @click.self="showAddSheet = false">
        <div class="sheet-panel">
          <h3>记一笔</h3>

          <label class="sheet-label">分类</label>
          <div class="sheet-categories">
            <button
              v-for="cat in data.categories"
              :key="cat"
              class="sheet-cat-btn"
              :class="{ active: addCategory === cat }"
              @click="addCategory = cat"
            >
              {{ categoryMeta[cat]?.icon || '' }} {{ cat }}
            </button>
          </div>

          <label class="sheet-label">金额</label>
          <input
            v-model="addAmount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            class="sheet-input amount-input"
          />

          <label class="sheet-label">日期</label>
          <input v-model="addDate" type="date" class="sheet-input" />

          <label class="sheet-label">备注（可选）</label>
          <input v-model="addNote" type="text" placeholder="添加备注..." class="sheet-input" />

          <button class="sheet-submit" @click="submitRecord">确认</button>
          <button class="sheet-cancel" @click="showAddSheet = false">取消</button>
        </div>
      </div>
    </Transition>

    <!-- ===== 预算设置 Sheet ===== -->
    <Transition name="sheet">
      <div v-if="showBudgetSheet" class="sheet-overlay" @click.self="showBudgetSheet = false">
        <div class="sheet-panel">
          <h3>月度预算</h3>
          <div
            v-for="cat in data.categories"
            :key="'budget-' + cat"
            class="budget-row"
          >
            <span class="budget-cat-label">{{ categoryMeta[cat]?.icon || '' }} {{ cat }}</span>
            <input
              :value="data.budgets[cat] || 0"
              type="number"
              step="1"
              min="0"
              class="budget-input"
              @change="e => updateBudget(cat, e.target.value)"
            />
          </div>
          <button class="sheet-submit" @click="showBudgetSheet = false">完成</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.accounting-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* ---- 顶栏 ---- */
.acct-top-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px 10px;
}

.acct-back {
  border: 0;
  border-radius: 999px;
  padding: 6px 12px;
  background: rgba(236, 65, 65, 0.1);
  color: var(--accent);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.acct-top-bar h1 {
  margin: 0;
  font-size: var(--text-title);
  flex: 1;
}

.acct-budget-btn {
  border: 0;
  border-radius: 8px;
  padding: 6px 14px;
  background: rgba(236, 65, 65, 0.08);
  color: var(--accent);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

/* ---- 月份切换 ---- */
.acct-month-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 6px 18px 14px;
  font-size: var(--text-headline);
  font-weight: 700;
}

.acct-month-bar button {
  border: 0;
  border-radius: 999px;
  width: 32px;
  height: 32px;
  background: rgba(118, 118, 128, 0.1);
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  display: grid;
  place-items: center;
}

/* ---- 滚动内容 ---- */
.acct-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 18px 100px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ---- 总览条 ---- */
.acct-summary {
  display: flex;
  align-items: center;
  border-radius: var(--radius-md);
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.72);
}

.summary-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.summary-label {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.summary-value {
  font-size: var(--text-headline);
  font-weight: 700;
}

.summary-value.over { color: var(--accent); }

.summary-divider {
  width: 1px;
  height: 32px;
  background: var(--separator);
}

/* ---- 分类预算卡片 ---- */
.acct-category-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.acct-cat-card {
  border-radius: var(--radius-md);
  padding: 12px;
  background: rgba(255, 255, 255, 0.72);
}

.cat-card-top {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.cat-icon { font-size: 16px; }
.cat-name {
  font-size: var(--text-footnote);
  font-weight: 700;
  color: var(--text-primary);
}

.cat-card-amount {
  margin-bottom: 6px;
}

.cat-spent {
  font-size: var(--text-body);
  font-weight: 700;
}

.acct-cat-card.over .cat-spent { color: var(--accent); }

.cat-budget {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.cat-progress {
  height: 4px;
  border-radius: 999px;
  background: rgba(118, 118, 128, 0.1);
  overflow: hidden;
}

.cat-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--accent);
  transition: width 0.3s ease;
}

.acct-cat-card.over .cat-progress-fill { background: var(--accent); }

/* ---- 记录列表 ---- */
.acct-records h3 {
  margin: 0 0 8px;
  font-size: var(--text-body);
}

.empty-records {
  padding: 24px;
  text-align: center;
  color: var(--text-secondary);
  font-size: var(--text-footnote);
}

.acct-record-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 12px;
  padding: 10px 12px;
  margin-bottom: 6px;
  background: rgba(255, 255, 255, 0.62);
}

.rec-left {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.rec-cat-tag {
  border-radius: 6px;
  padding: 2px 8px;
  background: rgba(236, 65, 65, 0.08);
  color: var(--accent);
  font-size: var(--text-caption);
  font-weight: 700;
  white-space: nowrap;
}

.rec-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.rec-date {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.rec-note {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}

.rec-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.rec-amount {
  font-size: var(--text-body);
  font-weight: 700;
  color: var(--text-primary);
}

.rec-del {
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 999px;
  background: rgba(118, 118, 128, 0.12);
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  display: grid;
  place-items: center;
}

/* ---- FAB ---- */
.acct-fab {
  position: absolute;
  right: 18px;
  bottom: 100px;
  z-index: 20;
  width: 52px;
  height: 52px;
  border: 0;
  border-radius: 999px;
  background: var(--accent);
  color: white;
  font-size: 26px;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(236, 65, 65, 0.35);
  display: grid;
  place-items: center;
}

/* ---- Sheet ---- */
.sheet-overlay {
  position: absolute;
  inset: 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: flex-end;
}

.sheet-panel {
  width: 100%;
  max-height: 80%;
  border-radius: 22px 22px 0 0;
  padding: 18px 18px 28px;
  background: var(--bg-card);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sheet-panel h3 {
  margin: 0 0 4px;
  font-size: var(--text-headline);
}

.sheet-label {
  font-size: var(--text-footnote);
  font-weight: 700;
  color: var(--text-secondary);
}

.sheet-input {
  border: 0;
  border-radius: 12px;
  padding: 10px 12px;
  background: rgba(118, 118, 128, 0.08);
  font-size: var(--text-body);
  color: var(--text-primary);
  outline: none;
}

.amount-input {
  font-size: 28px;
  font-weight: 700;
  text-align: center;
}

.sheet-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.sheet-cat-btn {
  border: 0;
  border-radius: 999px;
  padding: 6px 12px;
  background: rgba(118, 118, 128, 0.08);
  color: var(--text-secondary);
  font-size: var(--text-footnote);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.sheet-cat-btn.active {
  background: var(--accent);
  color: white;
}

.sheet-submit {
  border: 0;
  border-radius: 14px;
  padding: 14px;
  background: var(--accent);
  color: white;
  font-size: var(--text-body);
  font-weight: 700;
  cursor: pointer;
  margin-top: 4px;
}

.sheet-cancel {
  border: 0;
  border-radius: 14px;
  padding: 10px;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--text-body);
  cursor: pointer;
}

/* ---- 预算 Sheet ---- */
.budget-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.budget-cat-label {
  font-size: var(--text-body);
  font-weight: 600;
}

.budget-input {
  width: 100px;
  border: 0;
  border-radius: 10px;
  padding: 8px 12px;
  background: rgba(118, 118, 128, 0.08);
  font-size: var(--text-body);
  color: var(--text-primary);
  text-align: right;
  outline: none;
}

/* ---- Sheet transitions ---- */
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.25s ease;
}
.sheet-enter-active .sheet-panel,
.sheet-leave-active .sheet-panel {
  transition: transform 0.25s ease;
}
.sheet-enter-from,
.sheet-leave-to { opacity: 0; }
.sheet-enter-from .sheet-panel,
.sheet-leave-to .sheet-panel { transform: translateY(100%); }
</style>
```

- [ ] **Step 2: Build check**

```bash
npx vite build 2>&1 | tail -5
```
Expected: Build succeeds (the component exists but isn't wired up yet, so "✓ built" with no new errors).

- [ ] **Step 3: Commit**

```bash
git add src/components/AccountingView.vue
git commit -m "feat: add AccountingView component"
```

---

### Task 3: Wire Up Navigation (TabBar, HomeView, App.vue)

**Files:**
- Modify: `src/components/TabBar.vue`
- Modify: `src/components/HomeView.vue`
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: AccountingView emits `back`
- Consumes: TabBar expects `currentView` prop, emits `navigate`
- Consumes: HomeView emits `navigate`

- [ ] **Step 1: Add accounting tab to TabBar.vue**

In `src/components/TabBar.vue`, add the 5th tab to the `tabs` array:

```js
const tabs = [
  { id: 'music', icon: '🎵', label: '音乐' },
  { id: 'schedule', icon: '📅', label: '日程' },
  { id: 'pomodoro', icon: '🍅', label: '番茄' },
  { id: 'habit', icon: '✅', label: '习惯' },
  { id: 'accounting', icon: '💰', label: '记账' },
]
```

- [ ] **Step 2: Add accounting module to HomeView.vue**

In `src/components/HomeView.vue`, add an accounting entry to the `modules` computed array (after the pomodoro entry):

```js
  {
    id: 'accounting',
    icon: '💰',
    label: '记账',
    color: '#ff9f0a',
    bg: 'linear-gradient(135deg, #ff9f0a, #ffb340)',
    summary: '记录开销，管理预算',
  },
```

Also add an overview item to the `overviewItems` computed array (after the pomodoro entry):

```js
  {
    key: 'accounting',
    icon: '💰',
    label: '本月支出',
    value: '记一笔开销',
    navigateTo: 'accounting',
  },
```

- [ ] **Step 3: Add accounting routing to App.vue**

In `src/App.vue`:

Add import:
```js
import AccountingView from './components/AccountingView.vue'
```

Add view template:
```html
<AccountingView v-if="currentView === 'accounting'" @back="currentView = 'home'" />
```

Add `'accounting'` to the `playerViews` array so the mini player shows on this view too:
```js
const playerViews = ['music', 'profile', 'accounting']
```

Also update the `tabBarVisible` computed to show TabBar on accounting:
```js
const tabBarVisible = computed(() => !['profile'].includes(currentView.value))
```
(This already works since accounting !== 'profile')

- [ ] **Step 4: Build and verify**

```bash
npx vite build 2>&1 | tail -5
```
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/TabBar.vue src/components/HomeView.vue src/App.vue
git commit -m "feat: wire accounting view into navigation"
```

---

### Task 4: Integration Verification

- [ ] **Step 1: Start dev server and check for runtime errors**

```bash
npx vite build 2>&1
```

Expected: Clean build, no warnings.

- [ ] **Step 2: Verify all navigation paths**

Checklist:
- TabBar: 记账 tab appears and navigates to AccountingView
- HomeView: 记账 card appears in grid and navigates
- AccountingView: back button returns to home
- Sheet: FAB opens add-record sheet, categories select, amount/date/note input work
- Budget: budget button opens budget sheet, values update
- Records: records appear after adding, delete works
- Month: month switcher changes records display

- [ ] **Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "chore: integration fixes for accounting feature"
```
