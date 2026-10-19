<script setup lang="ts">
defineProps<{
  phase: string
  detail?: string
}>()
</script>

<template>
  <div class="loading-wrap">
    <div class="col">
      <div class="row">
        <div class="avatar" aria-hidden="true">
          <img src="/logo-tosuthien.png" alt="" width="28" height="28" />
        </div>
        <div class="body">
          <span class="chat-spinner" />
          <span class="copy">
            <span>
              {{ phase === 'generating' ? 'Đang soạn câu trả lời…' : 'Đang tra cứu kinh sách…' }}
            </span>
            <span v-if="detail && phase !== 'generating'" class="detail">{{ detail }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loading-wrap {
  width: 100%;
  padding: 0.5rem 0 1rem;
}

.col {
  width: var(--c-col);
  margin: 0 auto;
  padding: 0 1rem;
}

.row {
  display: flex;
  gap: 0.85rem;
  align-items: flex-start;
}

.avatar {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  background: var(--c-surface-mid);
}

.avatar img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.body {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  color: var(--c-muted);
  font-size: 0.92rem;
  padding-top: 0.3rem;
}

.copy {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.detail {
  font-size: 0.8rem;
  opacity: 0.85;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: min(100%, 36rem);
}
</style>
