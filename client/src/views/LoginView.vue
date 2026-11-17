<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { login, register } from '@/api'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const mode = ref<'login' | 'register'>('login')
const form = reactive({ email: '', password: '', name: '' })
const loading = ref(false)
const error = ref('')

const isRegister = computed(() => mode.value === 'register')

async function submit() {
  error.value = ''

  if (!form.email || !form.password) {
    error.value = '请填写邮箱和密码'
    return
  }
  if (isRegister.value && !form.name.trim()) {
    error.value = '请填写昵称'
    return
  }

  loading.value = true
  try {
    const data = isRegister.value
      ? await register(form.email, form.password, form.name.trim())
      : await login(form.email, form.password)

    userStore.setSession(data.token, data.user)
    router.push({ name: 'practice' })
  } catch (e) {
    error.value = e instanceof Error ? e.message : '操作失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth">
    <div class="card">
      <h1>AI 英语写作批改</h1>
      <p class="subtitle">提交你的英语作文，几秒内得到逐句批改和评分。</p>

      <div class="tabs">
        <button :class="{ active: mode === 'login' }" @click="mode = 'login'">登录</button>
        <button :class="{ active: mode === 'register' }" @click="mode = 'register'">注册</button>
      </div>

      <form @submit.prevent="submit">
        <div v-if="isRegister" class="field">
          <label for="name">昵称</label>
          <input id="name" v-model="form.name" placeholder="怎么称呼你" autocomplete="nickname" />
        </div>

        <div class="field">
          <label for="email">邮箱</label>
          <input
            id="email"
            v-model="form.email"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
          />
        </div>

        <div class="field">
          <label for="password">密码</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            placeholder="至少 6 位"
            :autocomplete="isRegister ? 'new-password' : 'current-password'"
          />
        </div>

        <button class="btn" style="width: 100%" :disabled="loading">
          {{ loading ? '请稍候…' : isRegister ? '注册并登录' : '登录' }}
        </button>
      </form>

      <p v-if="error" class="alert">{{ error }}</p>
    </div>
  </div>
</template>
