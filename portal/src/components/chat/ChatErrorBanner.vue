<script setup lang="ts">
defineProps<{ message: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div class="banner">
    <span>{{ message }}</span>
    <button type="button" @click="emit('close')">Đóng</button>
  </div>
</template>

<style scoped>
.banner {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
  background: var(--c-error-bg);
  color: var(--c-error);
  font-size: 0.88rem;
}

button {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-weight: 600;
}
</style>
