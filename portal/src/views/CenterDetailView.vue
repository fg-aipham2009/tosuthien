<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { getCenter, resolveMediaUrl } from '../api/centers'
import type { Center } from '../types'

const route = useRoute()
const center = ref<Center | null>(null)
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    center.value = await getCenter(String(route.params.id))
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được chi tiết'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <RouterLink class="back" to="/thien-duong">← Thiền đường</RouterLink>
    <p v-if="loading" class="muted">Đang tải…</p>
    <p v-else-if="error" class="err">{{ error }}</p>
    <template v-else-if="center">
      <img
        v-if="resolveMediaUrl(center.mainImageUrl)"
        class="hero"
        :src="resolveMediaUrl(center.mainImageUrl)"
        :alt="center.templeName"
      />
      <h1>{{ center.templeName }}</h1>
      <p class="meta">
        {{ [center.abbotRank, center.abbotName, center.abbotTitle].filter(Boolean).join(' · ') }}
      </p>
      <dl class="facts">
        <div v-if="center.address">
          <dt>Địa chỉ</dt>
          <dd>{{ center.address }}</dd>
        </div>
        <div v-if="center.phone">
          <dt>Điện thoại</dt>
          <dd>
            <a :href="`tel:${center.phone}`">{{ center.phone }}</a>
          </dd>
        </div>
        <div v-if="center.activityHours">
          <dt>Giờ công phu</dt>
          <dd class="pre">{{ center.activityHours }}</dd>
        </div>
      </dl>
      <p v-if="center.googleMapsUrl">
        <a class="maps" :href="center.googleMapsUrl" target="_blank" rel="noopener">Mở Google Maps</a>
      </p>
      <section v-if="center.rules" class="block">
        <h2>Quy củ</h2>
        <p class="pre">{{ center.rules }}</p>
      </section>
      <section v-if="center.customs" class="block">
        <h2>Phong tục</h2>
        <p class="pre">{{ center.customs }}</p>
      </section>
      <section v-if="center.detailContent" class="block">
        <h2>Giới thiệu</h2>
        <p class="pre">{{ center.detailContent }}</p>
      </section>
      <section v-if="center.courses?.length" class="block">
        <h2>Khóa tu</h2>
        <ul>
          <li v-for="course in center.courses" :key="course.id">
            <strong>{{ course.title || course.type }}</strong>
            <span v-if="course.scheduleNote"> — {{ course.scheduleNote }}</span>
            <p v-if="course.description" class="muted">{{ course.description }}</p>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.back {
  color: var(--gold-soft);
  font-size: 0.9rem;
}

.hero {
  width: 100%;
  max-height: 260px;
  object-fit: cover;
  border-radius: 14px;
  margin: 0.75rem 0;
  border: 1px solid var(--line);
}

h1 {
  margin: 0.35rem 0 0;
  font-family: var(--font-display);
  font-size: 1.55rem;
}

.meta {
  color: var(--gold-soft);
  margin: 0.35rem 0 1rem;
}

.facts {
  margin: 0;
}

.facts div {
  padding: 0.65rem 0;
  border-bottom: 1px solid var(--line);
}

.facts dt {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 0.25rem;
}

.facts dd {
  margin: 0;
}

.maps {
  display: inline-block;
  margin: 0.85rem 0;
  color: var(--ink);
  background: var(--gold);
  padding: 0.45rem 0.95rem;
  border-radius: 999px;
  font-weight: 500;
}

.block {
  margin-top: 1.35rem;
}

.block h2 {
  margin: 0 0 0.45rem;
  font-family: var(--font-display);
  font-size: 1.15rem;
}

.pre {
  white-space: pre-wrap;
  line-height: 1.55;
  margin: 0;
}

.muted {
  color: var(--muted);
}

.err {
  color: #e8a090;
}

ul {
  padding-left: 1.1rem;
}
</style>
