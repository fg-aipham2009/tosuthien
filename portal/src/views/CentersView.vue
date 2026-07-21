<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { listCenters, resolveMediaUrl } from '../api/centers'
import type { Center, CenterCourse, CenterRegion } from '../types'

const regions: { id: CenterRegion | ''; label: string }[] = [
  { id: '', label: 'Tất cả' },
  { id: 'NAM', label: 'Nam' },
  { id: 'TRUNG', label: 'Trung' },
  { id: 'BAC', label: 'Bắc' },
  { id: 'NUOC_NGOAI', label: 'Nước ngoài' },
]

const region = ref<CenterRegion | ''>('')
const centers = ref<Center[]>([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    centers.value = await listCenters(region.value || undefined)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được danh sách'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(region, load)

function abbotLine(c: Center): string | null {
  const name = [c.abbotRank, c.abbotName].filter(Boolean).join(' ').trim()
  if (!name) return null
  const title = c.abbotTitle?.trim()
  return title ? `${title} · ${name}` : name
}

function addressLine(c: Center): string | null {
  const parts = [c.address?.trim(), c.province?.trim()].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

function seasonBadge(c: Center): string | null {
  const courses = c.courses ?? []
  const spring = courses.some((x) => x.type === 'SPRING')
  const winter = courses.some((x) => x.type === 'WINTER')
  if (spring && winter) return 'Xuân · Đông'
  if (winter) return 'Mùa đông'
  if (spring) return 'Mùa xuân'
  return null
}

function sortedCourses(c: Center): CenterCourse[] {
  const rank = (type?: string | null) => {
    if (type === 'SPRING' || type === 'WINTER') return 0
    if (type === 'AN_CU') return 1
    return 2
  }
  return [...(c.courses ?? [])].sort((a, b) => {
    const d = rank(a.type) - rank(b.type)
    if (d !== 0) return d
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  })
}

function courseTypeLabel(course: CenterCourse): string {
  switch (course.type) {
    case 'SPRING':
      return 'Khóa mùa xuân'
    case 'WINTER':
      return 'Khóa mùa đông'
    case 'AN_CU':
      return 'An cư'
    case 'REGULAR':
      return 'Khóa tu thiền thất'
    case 'OTHER':
      return 'Khóa tu'
    default:
      return course.title || 'Khóa tu'
  }
}

function courseScheduleLabel(course: CenterCourse): string {
  const text = course.scheduleText?.trim() || course.scheduleNote?.trim()
  if (text) return text
  if (course.dayStart != null && course.dayEnd != null) {
    return `Ngày ${course.dayStart}–${course.dayEnd} hàng tháng`
  }
  if (course.startDate && course.endDate) {
    return `${fmtDate(course.startDate)} – ${fmtDate(course.endDate)}`
  }
  if (course.startDate) return `Từ ${fmtDate(course.startDate)}`
  return 'Lịch cập nhật sau'
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('vi-VN')
}

function courseChipClass(type?: string | null): string {
  switch (type) {
    case 'SPRING':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800'
    case 'WINTER':
      return 'border-sky-200 bg-sky-50 text-sky-800'
    case 'AN_CU':
      return 'border-amber-200 bg-amber-50 text-amber-900'
    default:
      return 'border-black/10 bg-[#F5EDE6] text-[#5D4037]'
  }
}
</script>

<template>
  <div class="w-full">
    <header class="mb-5">
      <h1 class="font-serif text-3xl font-bold tracking-tight text-ink">Thiền đường</h1>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          v-for="r in regions"
          :key="r.label"
          type="button"
          class="rounded-full border border-black/10 px-3.5 py-1.5 text-sm text-muted transition"
          :class="region === r.id ? 'border-transparent bg-brand font-semibold text-white' : 'bg-surface hover:border-brand/30'"
          @click="region = r.id"
        >
          {{ r.label }}
        </button>
      </div>
    </header>

    <p v-if="loading" class="text-muted">Đang tải…</p>
    <p v-else-if="error" class="text-red-800">{{ error }}</p>

    <ul v-else class="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <li v-for="c in centers" :key="c.id">
        <RouterLink
          class="flex h-full items-stretch overflow-hidden rounded-2xl border border-black/10 bg-surface transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"
          :to="`/thien-duong/${c.id}`"
        >
          <div
            class="flex aspect-square w-1/2 shrink-0 items-center justify-center self-start overflow-hidden bg-brand/10 text-brand"
          >
            <img
              v-if="resolveMediaUrl(c.mainImageUrl)"
              class="h-full w-full object-cover"
              :src="resolveMediaUrl(c.mainImageUrl)"
              :alt="c.templeName"
            />
            <span v-else class="text-4xl" aria-hidden="true">禅</span>
          </div>

          <div class="flex min-w-0 w-1/2 flex-1 flex-col p-4">
            <strong class="font-serif text-lg leading-snug font-semibold">{{ c.templeName }}</strong>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <span
                v-if="seasonBadge(c)"
                class="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800"
              >
                {{ seasonBadge(c) }}
              </span>
              <span
                v-else-if="(c.courses?.length ?? 0) > 0"
                class="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand"
              >
                Có khóa tu
              </span>
              <span
                v-if="c.province"
                class="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-muted"
              >
                {{ c.province }}
              </span>
            </div>

            <dl class="mt-3 space-y-1.5 text-sm">
              <div v-if="abbotLine(c)" class="flex gap-2">
                <dt class="w-14 shrink-0 font-semibold text-muted">Trụ trì</dt>
                <dd class="min-w-0 font-medium text-ink">{{ abbotLine(c) }}</dd>
              </div>
              <div v-if="c.phone" class="flex gap-2">
                <dt class="w-14 shrink-0 font-semibold text-muted">SĐT</dt>
                <dd class="min-w-0">
                  <a
                    class="font-medium text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand"
                    :href="`tel:${c.phone}`"
                    @click.stop
                  >
                    {{ c.phone }}
                  </a>
                </dd>
              </div>
              <div v-if="addressLine(c)" class="flex gap-2">
                <dt class="w-14 shrink-0 font-semibold text-muted">Địa chỉ</dt>
                <dd class="min-w-0">
                  <a
                    v-if="c.googleMapsUrl"
                    class="line-clamp-2 font-medium text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand"
                    :href="c.googleMapsUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    @click.stop
                  >
                    {{ addressLine(c) }}
                  </a>
                  <span v-else class="line-clamp-2 font-medium text-ink">{{ addressLine(c) }}</span>
                </dd>
              </div>
              <div v-if="c.activityHours" class="flex gap-2">
                <dt class="w-14 shrink-0 font-semibold text-muted">Giờ tu</dt>
                <dd class="line-clamp-3 min-w-0 whitespace-pre-wrap font-medium text-ink">
                  {{ c.activityHours }}
                </dd>
              </div>
            </dl>

            <div v-if="sortedCourses(c).length" class="mt-3">
              <p class="mb-1.5 text-xs font-bold tracking-wide text-muted uppercase">Khóa tu</p>
              <ul class="space-y-1.5">
                <li v-for="course in sortedCourses(c).slice(0, 4)" :key="course.id">
                  <span
                    class="inline-flex max-w-full rounded-full border px-2.5 py-1 text-xs font-semibold"
                    :class="courseChipClass(course.type)"
                  >
                    <span class="truncate">
                      {{ courseTypeLabel(course) }}: {{ courseScheduleLabel(course) }}
                    </span>
                  </span>
                </li>
              </ul>
              <p v-if="sortedCourses(c).length > 4" class="mt-1 text-xs text-muted">
                +{{ sortedCourses(c).length - 4 }} khóa khác
              </p>
            </div>
          </div>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
