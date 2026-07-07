<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  fetchCategories,
  fetchYoutubeVideos,
  createYoutube,
  updateYoutube,
  deleteYoutube,
  parseYoutubeId,
  youtubeWatchUrl,
  youtubeThumbUrl,
} from '@/api/media';
import type { MediaCategory, YoutubeFormData, YoutubeVideo } from '@/types/models';

const loading = ref(false);
const categories = ref<MediaCategory[]>([]);
const videos = ref<YoutubeVideo[]>([]);
const filterCategory = ref('');

const dialogOpen = ref(false);
const editing = ref<YoutubeVideo | null>(null);
const form = reactive<YoutubeFormData & { isPublished: boolean }>({
  categoryId: '',
  title: '',
  youtubeId: '',
  year: new Date().getFullYear(),
  description: '',
  sortOrder: 0,
  isPublished: true,
});
const urlInput = ref('');

async function load() {
  loading.value = true;
  try {
    videos.value = await fetchYoutubeVideos({
      category: filterCategory.value || undefined,
      all: true,
    });
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Không tải được video');
  } finally {
    loading.value = false;
  }
}

function openDialog(video?: YoutubeVideo) {
  editing.value = video ?? null;
  form.categoryId = video?.categoryId ?? categories.value[0]?.id ?? '';
  form.title = video?.title ?? '';
  form.youtubeId = video?.youtubeId ?? '';
  form.year = video?.year ?? new Date().getFullYear();
  form.description = video?.description ?? '';
  form.sortOrder = video?.sortOrder ?? 0;
  form.isPublished = video?.isPublished ?? true;
  urlInput.value = video ? youtubeWatchUrl(video.youtubeId) : '';
  dialogOpen.value = true;
}

function applyUrlInput() {
  const id = parseYoutubeId(urlInput.value);
  if (id) {
    form.youtubeId = id;
    if (!form.title.trim()) form.title = id;
  }
}

async function save() {
  applyUrlInput();
  if (!form.categoryId || !form.title.trim() || !form.youtubeId.trim()) {
    ElMessage.warning('Nhập danh mục, tiêu đề và link/ID YouTube');
    return;
  }
  const payload: YoutubeFormData = {
    categoryId: form.categoryId,
    title: form.title.trim(),
    youtubeId: form.youtubeId.trim(),
    year: form.year ?? undefined,
    description: form.description?.trim() || undefined,
    sortOrder: form.sortOrder,
    isPublished: form.isPublished,
  };
  try {
    if (editing.value) {
      await updateYoutube(editing.value.id, payload);
    } else {
      await createYoutube(payload);
    }
    dialogOpen.value = false;
    ElMessage.success('Đã lưu');
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Lưu thất bại');
  }
}

async function onDelete(video: YoutubeVideo) {
  try {
    await ElMessageBox.confirm(`Xóa video "${video.title}"?`, 'Xác nhận', { type: 'warning' });
    await deleteYoutube(video.id);
    ElMessage.success('Đã xóa');
    await load();
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(e instanceof Error ? e.message : 'Xóa thất bại');
    }
  }
}

onMounted(async () => {
  try {
    categories.value = await fetchCategories();
  } catch {
    categories.value = [];
  }
  await load();
});
</script>

<template>
  <div>
    <div class="page-header">
      <h1>YouTube</h1>
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon>
        Thêm video
      </el-button>
    </div>

    <el-card shadow="never">
      <div style="margin-bottom: 16px; display: flex; gap: 12px; align-items: center">
        <span>Lọc danh mục:</span>
        <el-select
          v-model="filterCategory"
          clearable
          placeholder="Tất cả"
          style="width: 220px"
          @change="load"
        >
          <el-option
            v-for="c in categories"
            :key="c.slug"
            :label="c.name"
            :value="c.slug"
          />
        </el-select>
      </div>

      <el-table v-loading="loading" :data="videos" stripe empty-text="Chưa có video">
        <el-table-column label="" width="100">
          <template #default="{ row }">
            <img
              :src="youtubeThumbUrl(row.youtubeId)"
              alt=""
              style="width: 88px; height: 50px; object-fit: cover; border-radius: 4px"
            >
          </template>
        </el-table-column>
        <el-table-column prop="title" label="Tiêu đề" min-width="200" />
        <el-table-column prop="youtubeId" label="ID" width="130" />
        <el-table-column label="Danh mục" width="140">
          <template #default="{ row }">{{ row.category?.name ?? '—' }}</template>
        </el-table-column>
        <el-table-column prop="year" label="Năm" width="80" />
        <el-table-column label="Hiển thị" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isPublished ? 'success' : 'info'" size="small">
              {{ row.isPublished ? 'Công khai' : 'Ẩn' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Thao tác" width="160" fixed="right">
          <template #default="{ row }">
            <el-link :href="youtubeWatchUrl(row.youtubeId)" target="_blank" type="primary">Mở</el-link>
            <el-button link type="primary" @click="openDialog(row)">Sửa</el-button>
            <el-button link type="danger" @click="onDelete(row)">Xóa</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogOpen"
      :title="editing ? 'Sửa video YouTube' : 'Thêm video YouTube'"
      width="520px"
    >
      <el-form label-position="top">
        <el-form-item label="Danh mục" required>
          <el-select v-model="form.categoryId" style="width: 100%">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="Link YouTube hoặc video ID">
          <el-input
            v-model="urlInput"
            placeholder="https://youtube.com/watch?v=... hoặc dQw4w9WgXcQ"
            @blur="applyUrlInput"
          />
        </el-form-item>
        <el-form-item label="Tiêu đề" required>
          <el-input v-model="form.title" />
        </el-form-item>
        <el-form-item label="Video ID" required>
          <el-input v-model="form.youtubeId" placeholder="11 ký tự" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="Năm">
              <el-input-number v-model="form.year" :min="1990" :max="2100" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Thứ tự">
              <el-input-number v-model="form.sortOrder" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="Mô tả">
          <el-input v-model="form.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="Công khai">
          <el-switch v-model="form.isPublished" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">Huỷ</el-button>
        <el-button type="primary" @click="save">Lưu</el-button>
      </template>
    </el-dialog>
  </div>
</template>
