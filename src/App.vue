<script setup>
import { computed, ref, watch } from 'vue'
import HomeView from './components/HomeView.vue'
import MusicView from './components/MusicView.vue'
import ProfileView from './components/ProfileView.vue'
import ScheduleView from './components/ScheduleView.vue'
import HabitView from './components/HabitView.vue'
import PomodoroView from './components/PomodoroView.vue'
import PlayerDock from './components/PlayerDock.vue'
import TabBar from './components/TabBar.vue'
import { usePlayerStore } from './stores/playerStore'

const store = usePlayerStore()
const currentView = ref('home')
const tabBarVisible = computed(() => currentView.value !== 'profile')
const showMiniPlayer = computed(() => currentView.value === 'music')

// 离开音乐页时自动关闭全屏播放器
watch(currentView, (v) => {
  if (v !== 'music' && store.state.playerOpen) {
    store.state.playerOpen = false
  }
})
</script>

<template>
  <div class="app-screen">
    <HomeView     v-if="currentView === 'home'"     @navigate="(v) => currentView = v" />
    <MusicView    v-if="currentView === 'music'"    :store="store" @navigate="(v) => currentView = v" />
    <ScheduleView v-if="currentView === 'schedule'" @back="currentView = 'home'" />
    <HabitView     v-if="currentView === 'habit'"    @back="currentView = 'home'" />
    <PomodoroView v-if="currentView === 'pomodoro'" @back="currentView = 'home'" />
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
</template>
