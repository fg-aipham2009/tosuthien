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
  <div class="mx-auto w-full max-w-4xl">
    <RouterLink class="text-sm font-semibold text-brand" to="/thien-duong">← Thiền đường</RouterLink>

    <p v-if="loading" class="mt-4 text-muted">Đang tải…</p>
    <p v-else-if="error" class="mt-4 text-red-800">{{ error }}</p>

    <template v-else-if="center">
      <img
        v-if="resolveMediaUrl(center.mainImageUrl)"
        class="mt-3 mb-4 h-56 w-full rounded-2xl border border-black/10 object-cover lg:h-72"
        :src="resolveMediaUrl(center.mainImageUrl)"
        :alt="center.templeName"
      />
      <h1 class="font-serif text-3xl font-bold tracking-tight">{{ center.templeName }}</h1>
      <p class="mt-2 mb-5 text-brand-soft">
        {{ [center.abbotRank, center.abbotName, center.abbotTitle].filter(Boolean).join(' · ') }}
      </p>

      <dl class="divide-y divide-black/10 border-y border-black/10">
        <div v-if="center.address" class="py-3">
          <dt class="mb-1 text-xs font-semibold tracking-wider text-brand uppercase">Địa chỉ</dt>
          <dd>{{ center.address }}</dd>
        </div>
        <div v-if="center.phone" class="py-3">
          <dt class="mb-1 text-xs font-semibold tracking-wider text-brand uppercase">Điện thoại</dt>
          <dd>
            <a class="text-brand underline" :href="`tel:${center.phone}`">{{ center.phone }}</a>
          </dd>
        </div>
        <div v-if="center.activityHours" class="py-3">
          <dt class="mb-1 text-xs font-semibold tracking-wider text-brand uppercase">Giờ công phu</dt>
          <dd class="whitespace-pre-wrap leading-relaxed">{{ center.activityHours }}</dd>
        </div>
      </dl>

      <p v-if="center.googleMapsUrl" class="mt-4">
        <a
          class="inline-block rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
          :href="center.googleMapsUrl"
          target="_blank"
          rel="noopener"
        >
          Mở Google Maps
        </a>
      </p>

      <section v-if="center.rules" class="mt-8">
        <h2 class="mb-2 font-serif text-xl font-bold">Quy củ</h2>
        <p class="whitespace-pre-wrap leading-relaxed">{{ center.rules }}</p>
      </section>
      <section v-if="center.customs" class="mt-8">
        <h2 class="mb-2 font-serif text-xl font-bold">Phong tục</h2>
        <p class="whitespace-pre-wrap leading-relaxed">{{ center.customs }}</p>
      </section>
      <section v-if="center.detailContent" class="mt-8">
        <h2 class="mb-2 font-serif text-xl font-bold">Giới thiệu</h2>
        <p class="whitespace-pre-wrap leading-relaxed">{{ center.detailContent }}</p>
      </section>
      <section v-if="center.courses?.length" class="mt-8">
        <h2 class="mb-3 font-serif text-xl font-bold">Khóa tu</h2>
        <ul class="space-y-3">
          <li v-for="course in center.courses" :key="course.id" class="rounded-xl border border-black/10 bg-surface p-3">
            <strong>{{ course.title || course.type }}</strong>
            <span v-if="course.scheduleNote" class="text-muted"> — {{ course.scheduleNote }}</span>
            <p v-if="course.description" class="mt-1 text-sm text-muted">{{ course.description }}</p>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
