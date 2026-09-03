<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps<{
  modelValue: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'pick-images': [];
  'files': [files: File[]];
}>();

const root = ref<HTMLDivElement | null>(null);
let savedRange: Range | null = null;
let applying = false;

function currentHtml() {
  return root.value?.innerHTML || '';
}

function emitHtml() {
  applying = true;
  emit('update:modelValue', currentHtml());
  void nextTick(() => {
    applying = false;
  });
}

function setHtml(html: string) {
  if (!root.value) return;
  const next = html?.trim() ? html : '<p><br></p>';
  if (root.value.innerHTML === next) return;
  root.value.innerHTML = next;
}

function saveSelection() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !root.value) return;
  const node = sel.anchorNode;
  if (!node || !root.value.contains(node)) return;
  savedRange = sel.getRangeAt(0).cloneRange();
}

function restoreSelection() {
  if (!savedRange || !root.value) return;
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(savedRange);
}

function escapeAttr(value: string) {
  return value.replace(/"/g, '&quot;');
}

/** Image block + empty paragraph so the caret lands below the image. */
function imageBlockHtml(url: string) {
  return `<p class="image-block"><img src="${escapeAttr(url)}" alt=""></p><p><br></p>`;
}

function placeCursorInParagraph(p: HTMLElement) {
  const sel = window.getSelection();
  if (!sel || !root.value) return;
  root.value.focus();
  const range = document.createRange();
  range.setStart(p, 0);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  savedRange = range.cloneRange();
}

function insertImages(urls: string[]) {
  if (!urls.length || !root.value) return;
  root.value.focus();
  restoreSelection();

  const html = urls.map(imageBlockHtml).join('');
  const sel = window.getSelection();
  const hasCaret =
    sel &&
    sel.rangeCount > 0 &&
    sel.anchorNode &&
    root.value.contains(sel.anchorNode);

  if (hasCaret && sel) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(range.createContextualFragment(html));
  } else {
    root.value.insertAdjacentHTML('beforeend', html);
  }

  const paragraphs = root.value.querySelectorAll('p');
  const last = paragraphs[paragraphs.length - 1];
  if (last instanceof HTMLElement) {
    placeCursorInParagraph(last);
  }
  emitHtml();
}

function onPaste(e: ClipboardEvent) {
  const files = [...(e.clipboardData?.files ?? [])].filter((file) =>
    file.type.startsWith('image/'),
  );
  if (files.length) {
    e.preventDefault();
    saveSelection();
    emit('files', files);
    return;
  }
  const text = e.clipboardData?.getData('text/plain');
  if (text && !e.clipboardData?.getData('text/html')) {
    e.preventDefault();
    document.execCommand('insertText', false, text);
  }
}

function onDrop(e: DragEvent) {
  const files = [...(e.dataTransfer?.files ?? [])].filter((file) =>
    file.type.startsWith('image/'),
  );
  if (!files.length) return;
  e.preventDefault();
  saveSelection();
  emit('files', files);
}

function onInput() {
  saveSelection();
  emitHtml();
}

watch(
  () => props.modelValue,
  (html) => {
    if (applying) return;
    setHtml(html);
  },
);

onMounted(() => {
  setHtml(props.modelValue);
  document.addEventListener('selectionchange', saveSelection);
});

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', saveSelection);
});

defineExpose({ insertImages, saveSelection });
</script>

<template>
  <div class="body-editor">
    <div class="toolbar">
      <el-button
        size="small"
        type="primary"
        plain
        :disabled="disabled"
        @mousedown.prevent="saveSelection"
        @click="emit('pick-images')"
      >
        Chèn ảnh vào bài
      </el-button>
      <span class="tip">Đặt con trỏ trong đoạn chữ, chèn ảnh — gõ tiếp ngay dưới ảnh.</span>
    </div>
    <div
      ref="root"
      class="canvas"
      :contenteditable="!disabled"
      data-placeholder="Viết tin tại đây. Có thể dán ảnh hoặc kéo thả vào giữa đoạn."
      @input="onInput"
      @keyup="saveSelection"
      @mouseup="saveSelection"
      @paste="onPaste"
      @drop="onDrop"
      @dragover.prevent
    />
  </div>
</template>

<style scoped>
.body-editor {
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-bottom: 1px solid #ebeef5;
  background: #fafafa;
}

.tip {
  color: #909399;
  font-size: 12px;
}

.canvas {
  min-height: 280px;
  padding: 16px 20px;
  outline: none;
  line-height: 1.75;
  font-size: 15px;
  text-align: justify;
}

.canvas:empty:before {
  content: attr(data-placeholder);
  color: #c0c4cc;
  text-align: left;
}

.canvas :deep(p) {
  margin: 0 0 0.85em;
  text-align: justify;
}

.canvas :deep(p.image-block),
.canvas :deep(p:has(> img:only-child)) {
  margin: 1em 0;
  text-align: center;
}

.canvas :deep(img) {
  display: inline-block;
  max-width: 100%;
  height: auto;
  margin: 0 auto;
  border-radius: 8px;
  vertical-align: middle;
}
</style>
