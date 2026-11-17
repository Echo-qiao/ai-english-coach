<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getRecord, listRecords, type RecordDetail, type RecordSummary } from '@/api'

const items = ref<RecordSummary[]>([])
const loading = ref(false)
const hasMore = ref(true)
const cursor = ref<string | undefined>(undefined)
const error = ref('')

const detail = ref<RecordDetail | null>(null)
const detailLoading = ref(false)

async function loadMore() {
  if (loading.value || !hasMore.value) return
  loading.value = true
  error.value = ''

  try {
    const data = await listRecords(cursor.value)
    items.value.push(...data.list)
    hasMore.value = data.hasMore
    cursor.value = data.nextCursor ?? undefined
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function openDetail(id: string) {
  detailLoading.value = true
  try {
    detail.value = await getRecord(id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    detailLoading.value = false
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

onMounted(loadMore)
</script>

<template>
  <section>
    <div class="card">
      <h1>历史记录</h1>
      <p class="subtitle">只显示你自己的记录，别人拿到 id 也打不开。</p>

      <p v-if="error" class="alert">{{ error }}</p>

      <div v-if="items.length === 0 && !loading" class="empty">
        还没有记录，去<RouterLink to="/practice">写一篇</RouterLink>吧。
      </div>

      <div
        v-for="item in items"
        :key="item.id"
        class="record"
        role="button"
        tabindex="0"
        @click="openDetail(item.id)"
        @keydown.enter="openDetail(item.id)"
      >
        <div class="record-main">
          <div class="record-title">{{ item.title }}</div>
          <div class="record-time">{{ formatTime(item.createdAt) }}</div>
        </div>
        <span v-if="item.score !== null" class="score">{{ item.score }}<small>分</small></span>
        <span v-else class="meta">未评分</span>
      </div>

      <div v-if="items.length > 0" class="row">
        <span class="meta">{{ hasMore ? '还有更多' : '已经到底了' }}</span>
        <button class="btn ghost" :disabled="loading || !hasMore" @click="loadMore">
          {{ loading ? '加载中…' : '加载更多' }}
        </button>
      </div>
    </div>

    <div v-if="detail" class="modal-mask" @click.self="detail = null">
      <div class="modal">
        <h2>{{ detail.title }}</h2>
        <div class="row" style="margin: 0 0 12px">
          <span class="meta">{{ formatTime(detail.createdAt) }}</span>
          <span v-if="detail.score !== null" class="score">{{ detail.score }}<small>分</small></span>
        </div>

        <h3 style="font-size: 14px">你的作文</h3>
        <div class="essay">{{ detail.essay }}</div>

        <h3 style="font-size: 14px">批改</h3>
        <pre class="stream">{{ detail.review }}</pre>

        <div class="row">
          <button class="btn ghost" @click="detail = null">关闭</button>
        </div>
      </div>
    </div>

    <div v-if="detailLoading" class="empty">加载中…</div>
  </section>
</template>
