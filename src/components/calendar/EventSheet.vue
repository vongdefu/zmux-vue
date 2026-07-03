<script setup>
import { computed, reactive, watch } from 'vue'
import { generateUID, CALENDAR_COLORS } from '../../services/calendarStorage'

const props = defineProps({
  visible: { type: Boolean, default: false },
  event: { type: Object, default: null },
  data: { type: Object, required: true },
})

const emit = defineEmits(['close', 'save', 'delete'])

const isEdit = computed(() => !!props.event)

const REPEAT_OPTIONS = [
  { label: '不重复', value: null },
  { label: '每天', value: { type: 'daily', interval: 1 } },
  { label: '每周', value: { type: 'weekly', interval: 1 } },
  { label: '每月', value: { type: 'monthly', interval: 1 } },
  { label: '每年', value: { type: 'yearly', interval: 1 } },
]

const ALERT_OPTIONS = [
  { label: '无', value: null },
  { label: '事件开始时', value: 0 },
  { label: '15 分钟前', value: 15 },
  { label: '1 小时前', value: 60 },
  { label: '1 天前', value: 1440 },
]

const form = reactive({
  title: '',
  allDay: false,
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  calendarId: '',
  location: '',
  notes: '',
  invitees: [],
  alerts: [],
  attachments: [],
  recurrence: null,
})

let inviteeInput = ''
let attachmentInput = ''

watch(() => props.visible, (v) => {
  if (!v) return
  if (props.event) {
    const e = props.event
    form.title = e.title || ''
    form.allDay = e.allDay || false
    form.startDate = (e.start || '').slice(0, 10)
    form.startTime = form.allDay ? '' : (e.start || '').slice(11, 16)
    form.endDate = (e.end || '').slice(0, 10)
    form.endTime = form.allDay ? '' : (e.end || '').slice(11, 16)
    form.calendarId = e.calendarId || props.data.calendars[0]?.id
    form.location = e.location || ''
    form.notes = e.notes || ''
    form.invitees = [...(e.invitees || [])]
    form.alerts = [...(e.alerts || [])]
    form.attachments = [...(e.attachments || [])]
    form.recurrence = e.recurrence ? { ...e.recurrence } : null
  } else {
    const today = new Date().toISOString().slice(0, 10)
    form.title = ''
    form.allDay = false
    form.startDate = today
    form.startTime = '09:00'
    form.endDate = today
    form.endTime = '10:00'
    form.calendarId = props.data.settings?.defaultCalendarId || props.data.calendars[0]?.id
    form.location = ''
    form.notes = ''
    form.invitees = []
    form.alerts = []
    form.attachments = []
    form.recurrence = null
  }
})

function onSave() {
  if (!form.title.trim()) return
  const startISO = form.allDay
    ? form.startDate
    : `${form.startDate}T${form.startTime || '00:00'}:00`
  const endISO = form.allDay
    ? form.endDate
    : `${form.endDate}T${form.endTime || '00:00'}:00`

  emit('save', {
    id: props.event?.id || generateUID(),
    calendarId: form.calendarId,
    title: form.title.trim(),
    location: form.location.trim(),
    notes: form.notes.trim(),
    start: startISO,
    end: endISO,
    allDay: form.allDay,
    recurrence: form.recurrence,
    invitees: [...form.invitees],
    attachments: [...form.attachments],
    alerts: [...form.alerts.filter(a => a !== null)],
  })
}

function onDelete() {
  if (props.event?.id) emit('delete', props.event.id)
}

function addInvitee() {
  const v = inviteeInput?.trim()
  if (v && !form.invitees.includes(v)) form.invitees.push(v)
  inviteeInput = ''
}

function addAttachment() {
  const v = attachmentInput?.trim()
  if (v && !form.attachments.includes(v)) form.attachments.push(v)
  attachmentInput = ''
}
</script>

<template>
  <Transition name="sheet">
    <div v-if="visible" class="event-sheet-overlay" @click.self="emit('close')">
      <div class="event-sheet">
        <div class="es-header">
          <button class="es-cancel" @click="emit('close')">取消</button>
          <span class="es-title">{{ isEdit ? '编辑事件' : '新建事件' }}</span>
          <button class="es-save" @click="onSave">保存</button>
        </div>
        <div class="es-body">
          <input v-model="form.title" class="es-title-input" placeholder="标题" />

          <!-- All-day toggle -->
          <label class="es-row"><span>全天</span><input type="checkbox" v-model="form.allDay" /></label>

          <!-- Date/Time -->
          <div class="es-row">
            <span>开始</span>
            <input type="date" v-model="form.startDate" class="es-dt" />
            <input v-if="!form.allDay" type="time" v-model="form.startTime" class="es-dt" />
          </div>
          <div class="es-row">
            <span>结束</span>
            <input type="date" v-model="form.endDate" class="es-dt" />
            <input v-if="!form.allDay" type="time" v-model="form.endTime" class="es-dt" />
          </div>

          <!-- Repeat -->
          <div class="es-row"><span>重复</span>
            <select v-model="form.recurrence" class="es-select">
              <option v-for="o in REPEAT_OPTIONS" :key="o.label" :value="o.value">{{ o.label }}</option>
            </select>
          </div>

          <!-- Calendar -->
          <div class="es-row"><span>日历</span>
            <select v-model="form.calendarId" class="es-select">
              <option v-for="c in data.calendars" :key="c.id" :value="c.id">● {{ c.name }}</option>
            </select>
          </div>

          <!-- Location -->
          <input v-model="form.location" class="es-input" placeholder="地点" />

          <!-- Invitees -->
          <div class="es-chips">
            <span v-for="(inv, i) in form.invitees" :key="i" class="es-chip">
              {{ inv }} <button @click="form.invitees.splice(i,1)">×</button>
            </span>
          </div>
          <div class="es-row"><input v-model="inviteeInput" class="es-input" placeholder="添加邀请人" @keydown.enter="addInvitee" /><button @click="addInvitee">+</button></div>

          <!-- Alerts -->
          <div class="es-row"><span>提醒</span>
            <div class="es-alerts">
              <label v-for="o in ALERT_OPTIONS" :key="o.label" class="es-alert-opt">
                <input type="checkbox" :value="o.value" v-model="form.alerts" /> {{ o.label }}
              </label>
            </div>
          </div>

          <!-- Notes -->
          <textarea v-model="form.notes" class="es-textarea" placeholder="备注" rows="3"></textarea>

          <!-- Attachments -->
          <div v-for="(url, i) in form.attachments" :key="i" class="es-att">
            <a :href="url" target="_blank">{{ url }}</a>
            <button @click="form.attachments.splice(i,1)">×</button>
          </div>
          <div class="es-row"><input v-model="attachmentInput" class="es-input" placeholder="附件链接" @keydown.enter="addAttachment" /><button @click="addAttachment">+</button></div>

          <!-- Delete -->
          <button v-if="isEdit" class="es-delete" @click="onDelete">删除事件</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.event-sheet-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.3);
  display: flex; align-items: flex-end; justify-content: center;
}
.event-sheet {
  width: 100%; max-width: 430px; max-height: 85vh;
  background: var(--bg-card); border-radius: 16px 16px 0 0;
  display: flex; flex-direction: column; overflow: hidden;
}
.es-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 0.5px solid var(--separator);
}
.es-cancel { border: 0; background: none; color: var(--text-secondary); font-size: var(--text-body); cursor: pointer; }
.es-title { font-weight: 700; font-size: var(--text-headline); color: var(--text-primary); }
.es-save { border: 0; background: none; color: var(--accent); font-weight: 700; font-size: var(--text-body); cursor: pointer; }
.es-body { flex: 1; overflow-y: auto; padding: 12px 16px 30px; display: flex; flex-direction: column; gap: 10px; }
.es-title-input { font-size: var(--text-title); font-weight: 700; border: 0; background: none; color: var(--text-primary); padding: 4px 0; }
.es-title-input:focus { outline: none; }
.es-row { display: flex; align-items: center; gap: 8px; font-size: var(--text-body); color: var(--text-primary); }
.es-row > span:first-child { width: 50px; flex-shrink: 0; color: var(--text-secondary); }
.es-dt, .es-select { flex: 1; border: 0; border-radius: var(--radius-sm); background: var(--separator); padding: 6px 8px; font-size: var(--text-body); color: var(--text-primary); }
.es-input { border: 0; border-radius: var(--radius-sm); background: var(--separator); padding: 8px 10px; font-size: var(--text-body); color: var(--text-primary); flex: 1; }
.es-textarea { border: 0; border-radius: var(--radius-sm); background: var(--separator); padding: 8px 10px; font-size: var(--text-body); color: var(--text-primary); resize: vertical; }
.es-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.es-chip { display: flex; align-items: center; gap: 2px; background: var(--accent-dim); color: var(--accent); padding: 2px 8px; border-radius: 999px; font-size: var(--text-footnote); }
.es-chip button { border: 0; background: none; color: var(--accent); cursor: pointer; }
.es-alerts { display: flex; flex-wrap: wrap; gap: 6px; }
.es-alert-opt { font-size: var(--text-footnote); color: var(--text-secondary); display: flex; align-items: center; gap: 4px; }
.es-delete { border: 0; background: none; color: var(--accent); font-size: var(--text-body); text-align: center; padding: 12px 0; cursor: pointer; margin-top: 8px; }
.es-att { display: flex; gap: 4px; align-items: center; font-size: var(--text-footnote); }
.es-att a { color: var(--accent); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.es-att button { border: 0; background: none; color: var(--text-secondary); cursor: pointer; }

.sheet-enter-active, .sheet-leave-active { transition: opacity 0.25s ease; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-active .event-sheet { transition: transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1); }
.sheet-enter-from .event-sheet { transform: translateY(100%); }
</style>
