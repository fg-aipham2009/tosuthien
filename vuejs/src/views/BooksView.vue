<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { UploadRawFile } from 'element-plus';
import { clearPdfCover, fetchPdfs, uploadPdfCover } from '@/api/pdfs';
import type { PdfFile } from '@/types/models';

const loading = ref(false);
const uploadingId = ref<string | null>(null);
const pdfs = ref<PdfFile[]>([]);
const q = ref('');

const IMAGE_MAX = 15 * 1024 * 1024;
const IMAGE_OK = /\.(jpe?g|png|webp|gif)$/i;

async function load() {
  loading.value = true;
  try {
    pdfs.value = await fetchPdfs();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Không tải được danh sách sách');
  } finally {
    loading.value = false;
  }
}

function filtered() {
  const s = q.value.trim().toLowerCase();
  if (!s) return pdfs.value;
  return pdfs.value.filter(
    (p) =>
      p.title.toLowerCase().includes(s) ||
      p.filename.toLowerCase().includes(s) ||
      (p.slug || '').toLowerCase().includes(s),
  );
}

function assertImage(file: File) {
  if (!IMAGE_OK.test(file.name)) {
    ElMessage.warning('Chỉ nhận JPG, PNG, WEBP, GIF');
    return false;
  }
  if (file.size > IMAGE_MAX) {
    ElMessage.warning('Ảnh tối đa 15MB');
    return false;
  }
  return true;
}

async function onCoverUpload(pdf: PdfFile, file: UploadRawFile) {
  if (!assertImage(file)) return false;
  uploadingId.value = pdf.id;
  try {
    const updated = await uploadPdfCover(pdf.id, file);
    const i = pdfs.value.findIndex((p) => p.id === pdf.id);
    if (i >= 0) pdfs.value[i] = { ...pdfs.value[i], ...updated };
    ElMessage.success(`Đã cập nhật bìa: ${pdf.title}`);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Upload bìa thất bại');
  } finally {
    uploadingId.value = null;
  }
  return false;
}

async function onClearCover(pdf: PdfFile) {
  try {
    await ElMessageBox.confirm('Xóa ảnh bìa sách này?', 'Xác nhận', { type: 'warning' });
    const updated = await clearPdfCover(pdf.id);
    const i = pdfs.value.findIndex((p) => p.id === pdf.id);
    if (i >= 0) pdfs.value[i] = { ...pdfs.value[i], ...updated, coverImageUrl: null };
    ElMessage.success('Đã xóa ảnh bìa');
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(e instanceof Error ? e.message : 'Xóa thất bại');
    }
  }
}

onMounted(load);
</script>

<template>
  <div v-loading="loading">
    <div class="page-header">
      <div>
        <h1>Kinh sách — ảnh bìa</h1>
        <p class="sub">Upload ảnh bìa cho từng PDF. Đọc chữ dùng chung bìa khi trùng tên file (1.pdf → sách 1).</p>
      </div>
      <el-button @click="load">Làm mới</el-button>
    </div>

    <el-input
      v-model="q"
      clearable
      placeholder="Tìm theo tên / file / slug…"
      style="max-width: 420px; margin-bottom: 16px"
    />

    <el-row :gutter="16">
      <el-col v-for="pdf in filtered()" :key="pdf.id" :xs="24" :sm="12" :md="8" :lg="6">
        <el-card shadow="hover" class="book-card" :body-style="{ padding: '12px' }">
          <div class="cover-wrap">
            <el-image
              v-if="pdf.coverImageUrl"
              :src="pdf.coverImageUrl"
              fit="cover"
              class="cover"
              :preview-src-list="[pdf.coverImageUrl]"
            />
            <div v-else class="cover placeholder">Chưa có bìa</div>
          </div>
          <div class="meta">
            <strong class="title">{{ pdf.title }}</strong>
            <span class="file">{{ pdf.filename }}</span>
          </div>
          <div class="actions">
            <el-upload
              :show-file-list="false"
              accept="image/jpeg,image/png,image/webp,image/gif"
              :disabled="uploadingId === pdf.id"
              :before-upload="(f: UploadRawFile) => onCoverUpload(pdf, f)"
            >
              <el-button size="small" type="primary" :loading="uploadingId === pdf.id">
                {{ pdf.coverImageUrl ? 'Đổi bìa' : 'Upload bìa' }}
              </el-button>
            </el-upload>
            <el-button
              v-if="pdf.coverImageUrl"
              size="small"
              type="danger"
              plain
              @click="onClearCover(pdf)"
            >
              Xóa
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-empty v-if="!loading && !filtered().length" description="Không có sách nào" />
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.page-header h1 {
  margin: 0 0 4px;
  font-size: 1.25rem;
}

.sub {
  margin: 0;
  color: #6b7280;
  font-size: 0.9rem;
  max-width: 40rem;
  line-height: 1.4;
}

.book-card {
  margin-bottom: 16px;
}

.cover-wrap {
  border-radius: 10px;
  overflow: hidden;
  background: #f3f4f6;
  aspect-ratio: 3 / 4;
  margin-bottom: 10px;
}

.cover {
  width: 100%;
  height: 100%;
  display: block;
}

.cover.placeholder {
  height: 100%;
  display: grid;
  place-items: center;
  color: #9ca3af;
  font-size: 0.85rem;
}

.meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 3.2rem;
  margin-bottom: 10px;
}

.title {
  font-size: 0.92rem;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.file {
  font-size: 0.75rem;
  color: #9ca3af;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
