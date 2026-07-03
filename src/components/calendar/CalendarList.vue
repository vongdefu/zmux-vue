<script setup>
import { ref } from 'vue'
import { CALENDAR_COLORS } from '../../services/calendarStorage'

const props = defineProps({
  calendars: { type: Array, required: true },
})

const emit = defineEmits(['update', 'delete', 'add', 'settings'])

const showAdd = ref(false)
const newName = ref('')
const newColor = ref(CALENDAR_COLORS[0])

function onAdd() {
  if (!newName.value.trim()) return
  emit('add', { name: newName.value.trim(), color: newColor.value })
  newName.value = ''
  showAdd.value = false
}
</script>

<template>
  <div class="cal-list">
    <h3>日历</h3>
    <div v-for="cal in calendars" :key="cal.id" class="cl-row">
      <span class="cl-dot" :style="{ background: cal.color }"></span>
      <span class="cl-name">{{ cal.name }}</span>
      <button class="cl-del" @click="emit('delete', cal.id)">🗑</button>
    </div>

    <div v-if="showAdd" class="cl-add-form">
      <input v-model="newName" placeholder="日历名称" class="cl-input" @keydown.enter="onAdd" />
      <div class="cl-colors">
        <button v-for="c in CALENDAR_COLORS" :key="c" class="cl-color-btn"
          :class="{ selected: newColor === c }"
          :style="{ background: c }" @click="newColor = c"></button>
      </div>
      <button class="cl-save" @click="onAdd">添加</button>
    </div>
    <button v-else class="cl-add" @click="showAdd = true">+ 添加日历</button>

    <div class="cl-settings">
      <h3>设置</h3>
      <label class="cl-setting-row">
        <span>周起始日</span>
        <select @change="emit('settings', { weekStartsOn: Number(($event.target).value) })">
          <option :value="0">周日</option>
          <option :value="1">周一</option>
        </select>
      </label>
      <button class="cl-export" @click="emit('export')">导出 .ics</button>
      <label class="cl-import">
        导入 .ics
        <input type="file" accept=".ics" @change="emit('import', $event)" hidden />
      </label>
    </div>
  </div>
</template>

<style scoped>
.cal-list { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
h3 { margin: 0; font-size: var(--text-headline); font-weight: 700; color: var(--text-primary); }
.cl-row { display: flex; align-items: center; gap: 10px; }
.cl-dot { width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0; }
.cl-name { flex: 1; font-size: var(--text-body); color: var(--text-primary); }
.cl-del { border: 0; background: none; cursor: pointer; font-size: 14px; opacity: 0.5; }
.cl-add { border: 0; background: var(--separator); border-radius: var(--radius-sm); padding: 8px; font-size: var(--text-body); color: var(--accent); cursor: pointer; text-align: left; }
.cl-add-form { display: flex; flex-direction: column; gap: 8px; }
.cl-input { border: 0; border-radius: var(--radius-sm); background: var(--separator); padding: 8px; font-size: var(--text-body); color: var(--text-primary); }
.cl-colors { display: flex; gap: 6px; }
.cl-color-btn { width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; }
.cl-color-btn.selected { border-color: var(--text-primary); }
.cl-save { border: 0; background: var(--accent); color: white; border-radius: var(--radius-sm); padding: 8px; font-size: var(--text-body); cursor: pointer; }
.cl-settings { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
.cl-setting-row { display: flex; justify-content: space-between; align-items: center; font-size: var(--text-body); color: var(--text-primary); }
.cl-export { border: 0; background: var(--separator); border-radius: var(--radius-sm); padding: 8px; font-size: var(--text-body); color: var(--text-secondary); cursor: pointer; }
.cl-import { border: 0; background: var(--separator); border-radius: var(--radius-sm); padding: 8px; font-size: var(--text-body); color: var(--text-secondary); cursor: pointer; display: block; }
</style>
