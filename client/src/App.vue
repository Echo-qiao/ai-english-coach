<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const showShell = computed(() => route.name !== 'login')

function handleLogout() {
  userStore.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="app">
    <header v-if="showShell" class="topbar">
      <RouterLink to="/practice" class="brand">✍️ AI 英语写作批改</RouterLink>
      <nav class="nav">
        <RouterLink to="/practice">练习</RouterLink>
        <RouterLink to="/history">历史</RouterLink>
      </nav>
      <div class="user">
        <span class="user-name">{{ userStore.user?.name }}</span>
        <button class="btn ghost" @click="handleLogout">退出</button>
      </div>
    </header>

    <main class="main">
      <RouterView />
    </main>
  </div>
</template>
