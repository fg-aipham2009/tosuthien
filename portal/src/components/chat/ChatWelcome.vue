<script setup lang="ts">
const suggestions = [
  'Tổ sư thiền là gì?',
  'Khán thoại đầu như thế nào?',
  'Pháp tham thiền của Hòa thượng Duy Lực',
]

const emit = defineEmits<{
  suggest: [text: string]
}>()
</script>

<template>
  <div class="welcome">
    <div class="hero">
      <img src="/logo-tosuthien.png" alt="" width="56" height="56" class="logo" />
      <h2>Tôi có thể giúp gì cho bạn?</h2>
      <p>Hỏi về giáo lý, ngữ lục và kinh sách Hòa thượng Thích Duy Lực.</p>
    </div>
    <div class="chips">
      <button
        v-for="s in suggestions"
        :key="s"
        type="button"
        class="chip"
        @click="emit('suggest', s)"
      >
        {{ s }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.welcome {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.75rem;
  width: var(--c-col);
  margin: 0 auto;
  padding: 2rem 1rem 1rem;
  text-align: center;
  min-height: 0;
}

.logo {
  border-radius: 50%;
  margin-bottom: 1rem;
  box-shadow: 0 4px 20px rgba(93, 64, 55, 0.18);
}

h2 {
  margin: 0 0 0.5rem;
  font-size: clamp(1.45rem, 3.5vw, 1.85rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--c-on);
}

p {
  margin: 0;
  color: var(--c-muted);
  line-height: 1.5;
  font-size: 0.95rem;
  max-width: 28rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  max-width: 36rem;
}

.chip {
  border: 1px solid var(--c-outline);
  background: var(--c-surface);
  border-radius: 999px;
  padding: 0.55rem 0.95rem;
  font: inherit;
  font-size: 0.88rem;
  color: var(--c-on);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.chip:hover {
  background: var(--c-surface-mid);
  border-color: rgba(93, 64, 55, 0.28);
}
</style>
