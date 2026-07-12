<script setup>
import { computed, ref, watch } from 'vue'
import HomeView from './features/home/HomeView.vue'
import MusicView from './features/music/MusicView.vue'
import ProfileView from './features/music/ProfileView.vue'
import ScheduleView from './features/schedule/ScheduleView.vue'
import HabitView from './features/habit/HabitView.vue'
import PomodoroView from './features/pomodoro/PomodoroView.vue'
import AccountingView from './features/accounting/AccountingView.vue'
import CalendarView from './features/calendar/CalendarView.vue'
import PlayerDock from './features/music/PlayerDock.vue'
import TabBar from './components/TabBar.vue'
import { usePlayerStore } from './stores/playerStore'

const store = usePlayerStore()
const currentView = ref('home')
const tabBarVisible = computed(() => currentView.value !== 'profile')
const playerViews = ['music']
const showMiniPlayer = computed(() => playerViews.includes(currentView.value))

// 离开音乐/个人页时自动关闭全屏播放器
watch(currentView, (v) => {
  if (!playerViews.includes(v) && store.state.playerOpen) {
    store.state.playerOpen = false
  }
})
</script>

<template>
  <div class="phone-app">
    <div class="app-screen">
        <HomeView     v-if="currentView === 'home'"     @navigate="(v) => currentView = v" />
        <MusicView    v-if="currentView === 'music'"    :store="store" @navigate="(v) => currentView = v" />
        <ScheduleView v-if="currentView === 'schedule'" @back="currentView = 'home'" />
        <HabitView     v-if="currentView === 'habit'"    @back="currentView = 'home'" />
        <PomodoroView v-if="currentView === 'pomodoro'" @back="currentView = 'home'" />
        <AccountingView v-if="currentView === 'accounting'" @back="currentView = 'home'" />
        <CalendarView v-if="currentView === 'calendar'" @back="currentView = 'home'" />
        <ProfileView  v-if="currentView === 'profile'"  :store="store" @back="currentView = 'music'" />

        <PlayerDock :store="store" :tabBarVisible="tabBarVisible" :showMiniPlayer="showMiniPlayer" />

        <TabBar
          v-if="tabBarVisible"
          :currentView="currentView"
          @navigate="(v) => currentView = v"
        />

        <Transition name="toast">
          <div v-if="store.state.toast" class="toast">
            {{ store.state.toast }}
          </div>
        </Transition>
      </div>
  </div>
</template>
