<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { UploadUserFile } from 'element-plus';
import {
  fetchFileRoots,
  listFolder,
  createFolder,
  deleteFile,
  uploadPdf,
  uploadImages,
  uploadMp3Batch,
} from '@/api/files';
import { fetchCategories, fetchMp3Tracks, deleteMp3Track, updateMp3Track } from '@/api/media';
import type {
  FileEntry,
  FolderListing,
  MediaCategory,
  MediaRoot,
  Mp3Track,
} from '@/types/models';

const ROOT_LABELS: Record<MediaRoot, string> = {
  pdf: 'PDF (Kinh sách)',
  mp3: 'MP3 (Pháp âm)',
  images: 'Hình ảnh',
};

const loading = ref(false);
const roots = ref<string[]>([]);
const currentRoot = ref<MediaRoot>('pdf');
const listing = ref<FolderListing | null>(null);
const newFolderName = ref('');
const showNewFolder = ref(false);

const categories = ref<MediaCategory[]>([]);
const mp3Tracks = ref<Mp3Track[]>([]);
const showMp3Upload = ref(false);
const mp3Uploading = ref(false);
const mp3Files = ref<File[]>([]);
const mp3Form = ref({
  categoryId: '',
  year: new Date().getFullYear(),
});

const showMp3Edit = ref(false);
const mp3Saving = ref(false);
const editingTrack = ref<Mp3Track | null>(null);
const editForm = ref({
  title: '',
  year: new Date().getFullYear(),
  categoryId: '',
  isPublished: true,
});

const breadcrumbs = computed(() => {
  const path = listing.value?.currentPath ?? '';
  if (!path) return [{ label: ROOT_LABELS[currentRoot.value], path: '' }];
  const parts = path.replace(/\/$/, '').split('/');
  const crumbs = [{ label: ROOT_LABELS[currentRoot.value], path: '' }];
  let acc = '';
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    crumbs.push({ label: part, path: `${acc}/` });
  }
  return crumbs;
});

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadMp3Tracks() {
  if (currentRoot.value !== 'mp3') {
    mp3Tracks.value = [];
    return;
  }
  try {
    mp3Tracks.value = await fetchMp3Tracks({
      folder: listing.value?.currentPath ?? '',
      all: true,
    });
  } catch {
    mp3Tracks.value = [];
  }
}

async function loadListing(path = listing.value?.currentPath ?? '') {
  loading.value = true;
  try {
    listing.value = await listFolder(currentRoot.value, path);
    await loadMp3Tracks();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Không tải được thư mục');
  } finally {
    loading.value = false;
  }
}

async function onRootChange(root: MediaRoot) {
  currentRoot.value = root;
  await loadListing('');
}

async function goToFolder(path: string) {
  await loadListing(path);
}

async function onCreateFolder() {
  const name = newFolderName.value.trim().replace(/\/+$/, '');
  if (!name) {
    ElMessage.warning('Nhập tên thư mục');
    return;
  }
  const base = listing.value?.currentPath ?? '';
  const fullPath = base ? `${base.replace(/\/$/, '')}/${name}` : name;
  try {
    listing.value = await createFolder(currentRoot.value, fullPath);
    newFolderName.value = '';
    showNewFolder.value = false;
    ElMessage.success('Đã tạo thư mục');
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Tạo thư mục thất bại');
  }
}

async function onDeleteFile(file: FileEntry) {
  try {
    await ElMessageBox.confirm(`Xóa file "${file.name}"?`, 'Xác nhận', { type: 'warning' });
    await deleteFile(currentRoot.value, file.path);
    ElMessage.success('Đã xóa file');
    await loadListing(listing.value?.currentPath ?? '');
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(e instanceof Error ? e.message : 'Xóa thất bại');
    }
  }
}

async function onDeleteMp3Track(track: Mp3Track) {
  try {
    await ElMessageBox.confirm(`Xóa bản ghi "${track.title}" khỏi DB?`, 'Xác nhận', { type: 'warning' });
    await deleteMp3Track(track.id);
    ElMessage.success('Đã xóa khỏi DB');
    await loadMp3Tracks();
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(e instanceof Error ? e.message : 'Xóa thất bại');
    }
  }
}

function openMp3Edit(track: Mp3Track) {
  editingTrack.value = track;
  editForm.value = {
    title: track.title,
    year: track.year,
    categoryId: track.categoryId,
    isPublished: track.isPublished,
  };
  showMp3Edit.value = true;
}

async function submitMp3Edit() {
  const track = editingTrack.value;
  if (!track) return;
  const title = editForm.value.title.trim();
  if (!title) {
    ElMessage.warning('Nhập tiêu đề');
    return;
  }
  if (!editForm.value.categoryId) {
    ElMessage.warning('Chọn danh mục');
    return;
  }
  mp3Saving.value = true;
  try {
    await updateMp3Track(track.id, {
      title,
      year: editForm.value.year,
      categoryId: editForm.value.categoryId,
      isPublished: editForm.value.isPublished,
    });
    ElMessage.success('Đã cập nhật (chỉ DB — file trên disk giữ nguyên)');
    showMp3Edit.value = false;
    editingTrack.value = null;
    await loadMp3Tracks();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Cập nhật thất bại');
  } finally {
    mp3Saving.value = false;
  }
}

async function onUploadPdf(file: UploadUserFile) {
  if (!file.raw) return false;
  try {
    await uploadPdf(file.raw, file.name.replace(/\.pdf$/i, ''));
    ElMessage.success('Đã upload PDF');
    await loadListing(listing.value?.currentPath ?? '');
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Upload thất bại');
  }
  return false;
}

async function onUploadImages(file: UploadUserFile) {
  if (!file.raw) return false;
  try {
    const folderPath = listing.value?.currentPath ?? '';
    await uploadImages(folderPath, [file.raw]);
    ElMessage.success('Đã upload ảnh');
    await loadListing(folderPath);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Upload thất bại');
  }
  return false;
}

function openMp3Upload() {
  if (!categories.value.length) {
    ElMessage.warning('Chưa có danh mục MP3 — tạo trong DB trước hoặc liên hệ dev');
    return;
  }
  if (!mp3Form.value.categoryId) {
    mp3Form.value.categoryId = categories.value[0].id;
  }
  mp3Files.value = [];
  showMp3Upload.value = true;
}

function onMp3FileChange(_file: UploadUserFile, fileList: UploadUserFile[]) {
  mp3Files.value = fileList.map((f) => f.raw).filter(Boolean) as File[];
  return false;
}

function onMp3FileRemove(_file: UploadUserFile, fileList: UploadUserFile[]) {
  mp3Files.value = fileList.map((f) => f.raw).filter(Boolean) as File[];
}

async function submitMp3Batch() {
  if (!mp3Form.value.categoryId) {
    ElMessage.warning('Chọn danh mục');
    return;
  }
  if (!mp3Files.value.length) {
    ElMessage.warning('Chọn ít nhất 1 file MP3');
    return;
  }
  mp3Uploading.value = true;
  try {
    const result = await uploadMp3Batch(mp3Files.value, {
      categoryId: mp3Form.value.categoryId,
      year: mp3Form.value.year,
      folderPath: listing.value?.currentPath ?? '',
    });
    ElMessage.success(`Đã upload ${result.count} file — tên file lưu vào DB làm tiêu đề`);
    showMp3Upload.value = false;
    mp3Files.value = [];
    await loadListing(listing.value?.currentPath ?? '');
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Upload MP3 thất bại');
  } finally {
    mp3Uploading.value = false;
  }
}

onMounted(async () => {
  try {
    roots.value = await fetchFileRoots();
    categories.value = await fetchCategories();
  } catch {
    roots.value = ['pdf', 'mp3', 'images'];
  }
  await loadListing('');
});

watch(showMp3Upload, (open) => {
  if (open && categories.value.length && !mp3Form.value.categoryId) {
    mp3Form.value.categoryId = categories.value[0].id;
  }
});
</script>

<template>
  <div>
    <div class="page-header">
      <h1>Quản lý file &amp; thư mục</h1>
    </div>

    <el-card shadow="never">
      <el-tabs :model-value="currentRoot" @tab-change="(n: string | number) => onRootChange(String(n) as MediaRoot)">
        <el-tab-pane
          v-for="root in roots"
          :key="root"
          :label="ROOT_LABELS[root as MediaRoot] ?? root"
          :name="root"
        />
      </el-tabs>

      <div style="margin: 16px 0; display: flex; flex-wrap: wrap; gap: 8px; align-items: center">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item v-for="(crumb, i) in breadcrumbs" :key="i">
            <span
              :class="{ 'breadcrumb-link': i < breadcrumbs.length - 1 }"
              @click="i < breadcrumbs.length - 1 && goToFolder(crumb.path)"
            >
              {{ crumb.label }}
            </span>
          </el-breadcrumb-item>
        </el-breadcrumb>

        <div style="margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap">
          <el-button @click="showNewFolder = true">
            <el-icon><FolderAdd /></el-icon>
            Tạo thư mục
          </el-button>
          <el-upload
            v-if="currentRoot === 'pdf'"
            :show-file-list="false"
            accept=".pdf"
            :before-upload="onUploadPdf"
          >
            <el-button type="primary">
              <el-icon><Upload /></el-icon>
              Upload PDF
            </el-button>
          </el-upload>
          <el-upload
            v-if="currentRoot === 'images'"
            :show-file-list="false"
            accept="image/*"
            multiple
            :before-upload="onUploadImages"
          >
            <el-button type="primary">
              <el-icon><Upload /></el-icon>
              Upload ảnh
            </el-button>
          </el-upload>
          <el-button v-if="currentRoot === 'mp3'" type="primary" @click="openMp3Upload">
            <el-icon><Upload /></el-icon>
            Upload MP3 (nhiều file)
          </el-button>
        </div>
      </div>

      <div v-loading="loading">
        <div v-if="listing?.folders.length" style="margin-bottom: 16px">
          <div style="font-weight: 600; margin-bottom: 8px">Thư mục</div>
          <el-space wrap>
            <el-button
              v-for="folder in listing.folders"
              :key="folder"
              @click="goToFolder(folder)"
            >
              <el-icon><Folder /></el-icon>
              {{ folder.replace(/\/$/, '').split('/').pop() }}
            </el-button>
          </el-space>
        </div>

        <el-table :data="listing?.files ?? []" stripe empty-text="Chưa có file trên disk">
          <el-table-column prop="name" label="Tên file" min-width="200" />
          <el-table-column label="Kích thước" width="100">
            <template #default="{ row }">{{ formatSize(row.size) }}</template>
          </el-table-column>
          <el-table-column prop="modifiedAt" label="Sửa lúc" width="180">
            <template #default="{ row }">
              {{ new Date(row.modifiedAt).toLocaleString('vi-VN') }}
            </template>
          </el-table-column>
          <el-table-column label="Thao tác" width="160">
            <template #default="{ row }">
              <el-link :href="row.url" target="_blank" type="primary">Mở</el-link>
              <el-button link type="danger" @click="onDeleteFile(row)">Xóa file</el-button>
            </template>
          </el-table-column>
        </el-table>

        <template v-if="currentRoot === 'mp3'">
          <div style="font-weight: 600; margin: 24px 0 12px">
            Bản ghi MP3 trong DB (thư mục hiện tại)
            <span v-if="listing?.currentPath" style="font-weight: 400; color: #909399">
              — {{ listing.currentPath }}
            </span>
          </div>
          <el-table :data="mp3Tracks" stripe empty-text="Chưa có bản ghi DB trong thư mục này">
            <el-table-column prop="title" label="Tiêu đề (hiển thị)" min-width="220" />
            <el-table-column prop="filename" label="File trên disk" min-width="160" />
            <el-table-column label="Danh mục" width="140">
              <template #default="{ row }">{{ row.category?.name ?? '—' }}</template>
            </el-table-column>
            <el-table-column prop="year" label="Năm" width="80" />
            <el-table-column label="Công khai" width="90">
              <template #default="{ row }">
                <el-tag :type="row.isPublished ? 'success' : 'info'" size="small">
                  {{ row.isPublished ? 'Có' : 'Ẩn' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="Thao tác" width="200">
              <template #default="{ row }">
                <el-button link type="primary" @click="openMp3Edit(row)">Sửa</el-button>
                <el-link :href="row.publicUrl" target="_blank" type="primary">Nghe</el-link>
                <el-button link type="danger" @click="onDeleteMp3Track(row)">Xóa DB</el-button>
              </template>
            </el-table-column>
          </el-table>
        </template>
      </div>
    </el-card>

    <el-dialog v-model="showNewFolder" title="Tạo thư mục mới" width="400px">
      <el-input v-model="newFolderName" placeholder="Tên thư mục (vd: 2026-thang-3)" @keyup.enter="onCreateFolder" />
      <template #footer>
        <el-button @click="showNewFolder = false">Huỷ</el-button>
        <el-button type="primary" @click="onCreateFolder">Tạo</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showMp3Upload" title="Upload nhiều MP3" width="560px" :close-on-click-modal="false">
      <el-form label-position="top">
        <el-row :gutter="16">
          <el-col :span="14">
            <el-form-item label="Danh mục" required>
              <el-select v-model="mp3Form.categoryId" style="width: 100%" placeholder="Chọn danh mục">
                <el-option
                  v-for="c in categories"
                  :key="c.id"
                  :label="c.name"
                  :value="c.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="10">
            <el-form-item label="Năm" required>
              <el-input-number v-model="mp3Form.year" :min="1990" :max="2100" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="Thư mục lưu">
          <el-input :model-value="listing?.currentPath || '(gốc mp3/)'" disabled />
        </el-form-item>
        <el-form-item label="File MP3 (tiêu đề = tên file, không đuôi .mp3)">
          <el-upload
            drag
            multiple
            accept=".mp3,audio/mpeg"
            :auto-upload="false"
            :file-list="[]"
            :on-change="onMp3FileChange"
            :on-remove="onMp3FileRemove"
          >
            <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
            <div class="el-upload__text">Kéo thả hoặc bấm để chọn nhiều file MP3</div>
          </el-upload>
          <div v-if="mp3Files.length" style="margin-top: 8px; color: #606266; font-size: 13px">
            Đã chọn {{ mp3Files.length }} file
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showMp3Upload = false">Huỷ</el-button>
        <el-button type="primary" :loading="mp3Uploading" @click="submitMp3Batch">
          Upload &amp; lưu DB
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showMp3Edit"
      title="Sửa bản ghi MP3 (chỉ DB)"
      width="480px"
      :close-on-click-modal="false"
    >
      <el-form label-position="top">
        <el-form-item label="File trên disk (không đổi)">
          <el-input :model-value="editingTrack?.filename ?? ''" disabled />
        </el-form-item>
        <el-form-item label="Thư mục" >
          <el-input :model-value="editingTrack?.folderPath || '(gốc)'" disabled />
        </el-form-item>
        <el-form-item label="Tiêu đề hiển thị" required>
          <el-input v-model="editForm.title" placeholder="Tên hiện trên app / portal" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="14">
            <el-form-item label="Danh mục" required>
              <el-select v-model="editForm.categoryId" style="width: 100%">
                <el-option
                  v-for="c in categories"
                  :key="c.id"
                  :label="c.name"
                  :value="c.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="10">
            <el-form-item label="Năm" required>
              <el-input-number v-model="editForm.year" :min="1990" :max="2100" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="Công khai">
          <el-switch v-model="editForm.isPublished" active-text="Hiện" inactive-text="Ẩn" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showMp3Edit = false">Huỷ</el-button>
        <el-button type="primary" :loading="mp3Saving" @click="submitMp3Edit">Lưu</el-button>
      </template>
    </el-dialog>
  </div>
</template>
