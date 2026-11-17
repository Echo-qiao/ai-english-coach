<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { streamReview } from '@/api'

const essay = ref('')
const output = ref('')
const streaming = ref(false)
const score = ref<number | null>(null)
const error = ref('')
const outputRef = ref<HTMLElement | null>(null)

let controller: AbortController | null = null

const charCount = computed(() => essay.value.length)
const wordCount = computed(() => essay.value.trim().split(/\s+/).filter(Boolean).length)
const canSubmit = computed(() => essay.value.trim().length >= 10 && !streaming.value)

async function start() {
  if (!canSubmit.value) return

  output.value = ''
  score.value = null
  error.value = ''
  streaming.value = true
  controller = new AbortController()

  try {
    await streamReview(
      essay.value,
      {
        onDelta: (text) => {
          output.value += text
        },
        onDone: (payload) => {
          score.value = payload.score
        },
        onError: (message) => {
          error.value = message
        },
      },
      controller.signal,
    )
  } catch (e) {
    // 用户主动取消不算错误
    if (!(e instanceof DOMException && e.name === 'AbortError')) {
      error.value = e instanceof Error ? e.message : '请求失败'
    }
  } finally {
    streaming.value = false
    controller = null
  }
}

function cancel() {
  controller?.abort()
}

// 输出变长时自动滚到底部
watch(output, async () => {
  await nextTick()
  const el = outputRef.value
  if (el) el.scrollTop = el.scrollHeight
})
</script>

<template>
  <section>
    <div class="card">
      <h1>写点什么</h1>
      <p class="subtitle">建议 80 词以上，批改会更准确。</p>

      <textarea
        v-model="essay"
        placeholder="例如：I go to school yesterday. I am interesting in music..."
        :disabled="streaming"
      />

      <div class="row">
        <span class="meta">{{ charCount }} 字符 · {{ wordCount }} 词</span>
        <div style="display: flex; gap: 8px">
          <button v-if="streaming" class="btn ghost" @click="cancel">取消</button>
          <button class="btn" :disabled="!canSubmit" @click="start">
            {{ streaming ? '批改中…' : '开始批改' }}
          </button>
        </div>
      </div>

      <p v-if="error" class="alert">{{ error }}</p>
    </div>

    <div v-if="output || streaming" class="card">
      <div class="row" style="margin: 0 0 12px">
        <strong style="font-size: 14px">批改结果</strong>
        <span v-if="score !== null" class="score">{{ score }}<small>分</small></span>
        <span v-else-if="streaming" class="meta">生成中…</span>
      </div>

      <pre ref="outputRef" class="stream">{{ output }}<span v-if="streaming" class="caret" /></pre>

      <div v-if="!streaming && output" class="row">
        <span class="meta">已保存到历史记录</span>
        <RouterLink to="/history" class="btn ghost" style="text-decoration: none">查看历史</RouterLink>
      </div>
    </div>
  </section>
</template>
