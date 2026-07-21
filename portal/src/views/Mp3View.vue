<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { listCategories } from '../api/mp3'
import type { MediaCategory } from '../types'

const cats = ref<MediaCategory[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    cats.value = await listCategories()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được album'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <header class="head">
      <h1>MP3 khai thị</h1>
      <p class="sub">Chọn album để nghe trên trình duyệt.</p>
    </header>
    <p v-if="loading" class="muted">Đang tải…</p>
    <p v-else-if="error" class="err">{{ error }}</p>
    <ul v-else class="list">
      <li v-for="c in cats" :key="c.id">
        <RouterLink :to="`/mp3/${c.slug}`">
          <strong>{{ c.name }}</strong>
          <span v-if="c.description">{{ c.description }}</span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.head {
  margin-bottom: 1rem;
}

h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.65rem;
}

.sub {
  margin: 0.35rem 0 0;
  color: var(--muted);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--line);
}

.list li {
  border-bottom: 1px solid var(--line);
}

.list a {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1rem 0.1rem;
}

.list strong {
  font-family: var(--font-display);
  font-size: 1.08rem;
}

.list span {
  color: var(--muted);
  font-size: 0.85rem;
}

.muted {
  color: var(--muted);
}

.err {
  color: #e8a090;
}
</style>
