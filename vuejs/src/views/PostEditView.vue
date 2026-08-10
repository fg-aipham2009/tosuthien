<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules, UploadRawFile } from 'element-plus';
import {
  fetchPost,
  createPost,
  updatePost,
  fetchPostCategories,
  uploadPostCover,
  clearPostCoverImage,
  uploadPostImages,
  deletePostImage,
} from '@/api/posts';
import { fetchZoomRooms } from '@/api/zoom-rooms';
import type { PostCategory, PostFormData, PostImage, ZoomRoom } from '@/types/models';

const route = useRoute();
const router = useRouter();

const activePostId = ref<string | null>(null);

const isNew = computed(() => route.name === 'post-new' && !activePostId.value);
const postId = computed(
  () => activePostId.value || (route.name === 'post-new' ? null : String(route.params.id)),
);

const saving = ref(false);
const loading = ref(false);
const formRef = ref<FormInstance>();
const categories = ref<PostCategory[]>([]);
const zoomRooms = ref<ZoomRoom[]>([]);

const form = reactive({
  title: '',
  categoryIds: [] as string[],
  publishedAt: null as string | null,
  isPublished: true,
  topicText: '',
  teacherText: '',
  scheduleText: '',
  zoomRoomId: null as string | null,
  description: '',
});

const coverImageUrl = ref<string | null>(null);
const images = ref<PostImage[]>([]);
const contentImages = computed(() => images.value.filter((image) => image.role !== 'cover'));
const uploadingCover = ref(false);
const uploadingImages = ref(false);

const selectedZoomHint = computed(() => {
  const room = zoomRooms.value.find((z) => z.id === form.zoomRoomId);
  if (!room) return '';
  return `ID: ${room.meetingId}${room.pass ? ` · Pass: ${room.pass}` : ''}`;
});

const IMAGE_MAX = 15 * 1024 * 1024;
const IMAGE_OK = /\.(jpe?g|png|webp|gif)$/i;

const rules: FormRules = {
  title: [{ required: true, message: 'Nhập tiêu đề', trigger: 'blur' }],
};

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

function defaultTinTucCategoryIds(): string[] {
  const tinTuc = categories.value.find((c) => c.slug === 'tin-tuc');
  return tinTuc ? [tinTuc.id] : [];
}

function applyPost(p: Awaited<ReturnType<typeof fetchPost>>) {
  form.title = p.title ?? '';
  form.categoryIds = (p.categories ?? []).map((c) => c.id);
  form.publishedAt = p.publishedAt ? p.publishedAt.slice(0, 19) : null;
  form.isPublished = p.isPublished ?? true;
  form.topicText = p.topicText ?? '';
  form.teacherText = p.teacherText ?? '';
  form.scheduleText = p.scheduleText ?? '';
  form.zoomRoomId =
    p.zoomRoomId ||
    zoomRooms.value.find(
      (z) => z.meetingId === (p.zoomMeetingId || '').replace(/\s/g, ''),
    )?.id ||
    null;
  form.description = p.description ?? '';
  coverImageUrl.value = p.coverImageUrl;
  images.value = p.images ?? [];
}

async function loadCategories() {
  try {
    categories.value = await fetchPostCategories();
    if (isNew.value && form.categoryIds.length === 0) {
      form.categoryIds = defaultTinTucCategoryIds();
    }
  } catch {
    categories.value = [];
  }
}

async function loadZoomRooms() {
  try {
    zoomRooms.value = await fetchZoomRooms(true);
  } catch {
    zoomRooms.value = [];
  }
}

async function loadPost() {
  const id =
    route.name === 'post-new'
      ? activePostId.value
      : String(route.params.id || '');
  if (!id) return;
  loading.value = true;
  try {
    const p = await fetchPost(id);
    activePostId.value = p.id;
    applyPost(p);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Không tải được dữ liệu');
  } finally {
    loading.value = false;
  }
}

function buildPayload(): PostFormData {
  return {
    title: form.title.trim(),
    categoryIds: form.categoryIds.length
      ? form.categoryIds
      : defaultTinTucCategoryIds(),
    publishedAt: form.publishedAt || null,
    isPublished: form.isPublished,
    topicText: form.topicText.trim(),
    teacherText: form.teacherText.trim(),
    scheduleText: form.scheduleText.trim(),
    zoomRoomId: form.zoomRoomId,
    description: form.description.trim(),
  };
}

/** Create draft post when uploading images on the "new" screen. */
async function ensurePostId(): Promise<string | null> {
  if (postId.value) return postId.value;
  const title = form.title.trim();
  if (!title) {
    ElMessage.warning('Nhập tiêu đề trước khi upload ảnh');
    return null;
  }
  saving.value = true;
  try {
    const created = await createPost(buildPayload());
    activePostId.value = created.id;
    applyPost(created);
    await router.replace(`/posts/${created.id}`);
    ElMessage.success('Đã tạo bài — tiếp tục upload ảnh');
    return created.id;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Không tạo được bài');
    return null;
  } finally {
    saving.value = false;
  }
}

async function save() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  saving.value = true;
  try {
    if (!postId.value) {
      const created = await createPost(buildPayload());
      activePostId.value = created.id;
      applyPost(created);
      ElMessage.success('Đã tạo bài viết');
      await router.replace(`/posts/${created.id}`);
    } else {
      const updated = await updatePost(postId.value, buildPayload());
      applyPost(updated);
      ElMessage.success('Đã lưu');
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Lưu thất bại');
  } finally {
    saving.value = false;
  }
}

async function onCoverUpload(file: UploadRawFile) {
  if (!assertImage(file)) return false;
  const id = await ensurePostId();
  if (!id) return false;
  uploadingCover.value = true;
  try {
    const updated = await uploadPostCover(id, file);
    coverImageUrl.value = updated.coverImageUrl;
    images.value = updated.images ?? images.value;
    ElMessage.success('Đã cập nhật ảnh bìa');
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Upload thất bại');
  } finally {
    uploadingCover.value = false;
  }
  return false;
}

async function onClearCover() {
  if (!postId.value || !coverImageUrl.value) return;
  try {
    await ElMessageBox.confirm('Xóa ảnh bìa?', 'Xác nhận', { type: 'warning' });
    const updated = await clearPostCoverImage(postId.value);
    coverImageUrl.value = updated.coverImageUrl ?? null;
    ElMessage.success('Đã xóa ảnh bìa');
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(e instanceof Error ? e.message : 'Xóa thất bại');
    }
  }
}

async function onImagesUpload(file: UploadRawFile) {
  if (!assertImage(file)) return false;
  const id = await ensurePostId();
  if (!id) return false;
  uploadingImages.value = true;
  try {
    const updated = await uploadPostImages(id, [file]);
    images.value = updated.images ?? [];
    ElMessage.success('Đã thêm ảnh');
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Upload thất bại');
  } finally {
    uploadingImages.value = false;
  }
  return false;
}

async function onDeleteImage(img: PostImage) {
  if (!postId.value) return;
  try {
    await ElMessageBox.confirm('Xóa ảnh này?', 'Xác nhận', { type: 'warning' });
    const updated = await deletePostImage(postId.value, img.id);
    images.value = updated.images ?? images.value.filter((i) => i.id !== img.id);
    ElMessage.success('Đã xóa ảnh');
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(e instanceof Error ? e.message : 'Xóa thất bại');
    }
  }
}

function goBack() {
  router.push('/posts');
}

onMounted(async () => {
  activePostId.value =
    route.name === 'post-new' ? null : String(route.params.id || '') || null;
  await Promise.all([loadCategories(), loadZoomRooms()]);
  await loadPost();
});

watch(
  () => route.params.id,
  async () => {
    if (route.name === 'post-new') {
      activePostId.value = null;
      return;
    }
    activePostId.value = String(route.params.id || '') || null;
    await loadPost();
  },
);
</script>

<template>
  <div v-loading="loading">
    <div class="page-header">
      <h1>{{ isNew ? 'Thêm tin tức' : 'Chỉnh sửa tin tức' }}</h1>
      <div>
        <el-button @click="goBack">Quay lại</el-button>
        <el-button type="primary" :loading="saving" @click="save">Lưu</el-button>
      </div>
    </div>

    <el-card shadow="never">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="Tiêu đề" prop="title">
          <el-input
            v-model="form.title"
            placeholder="VD: Thông báo lớp học chuyên đề …"
          />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :xs="24" :md="12">
            <el-form-item label="Ngày đăng">
              <el-date-picker
                v-model="form.publishedAt"
                type="datetime"
                value-format="YYYY-MM-DDTHH:mm:ss"
                placeholder="Để trống = giờ hiện tại"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="Công khai">
              <el-switch v-model="form.isPublished" />
            </el-form-item>
          </el-col>
        </el-row>

        <div class="form-section-title">Thông tin lớp học</div>
        <el-row :gutter="16">
          <el-col :xs="24" :md="12">
            <el-form-item label="1. Đề tài">
              <el-input v-model="form.topicText" placeholder="VD: Duy Lực Ngữ Lục 44" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="2. Giảng sư">
              <el-input
                v-model="form.teacherText"
                placeholder="VD: Hoà thượng Thích Minh Hiền"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="3. Thời gian">
              <el-input
                v-model="form.scheduleText"
                type="textarea"
                :rows="3"
                placeholder="Lịch học / ngày giờ"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="4. Zoom">
              <el-select
                v-model="form.zoomRoomId"
                clearable
                filterable
                placeholder="Chọn phòng Zoom"
                style="width: 100%"
              >
                <el-option
                  v-for="z in zoomRooms"
                  :key="z.id"
                  :label="`${z.name} — ID ${z.meetingId}`"
                  :value="z.id"
                />
              </el-select>
              <p v-if="selectedZoomHint" class="hint zoom-hint">{{ selectedZoomHint }}</p>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="Mô tả thêm (tuỳ chọn)">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="Có thể để trống"
          />
        </el-form-item>
      </el-form>

      <div class="form-section-title">Ảnh bìa (danh sách tin)</div>
      <p class="hint">
        JPG / PNG / WEBP / GIF · tối đa 15MB. Có thể upload ngay khi tạo bài (cần có tiêu đề).
      </p>
      <div class="main-row">
        <el-image
          v-if="coverImageUrl"
          :src="coverImageUrl"
          fit="cover"
          class="main-preview"
          :preview-src-list="[coverImageUrl]"
        />
        <div v-else class="main-preview empty">Chưa có ảnh bìa</div>
        <div class="main-actions">
          <el-upload
            :show-file-list="false"
            accept="image/jpeg,image/png,image/webp,image/gif"
            :disabled="uploadingCover || saving"
            :before-upload="onCoverUpload"
          >
            <el-button type="primary" :loading="uploadingCover || saving">
              {{ coverImageUrl ? 'Đổi ảnh bìa' : 'Upload ảnh bìa' }}
            </el-button>
          </el-upload>
          <el-button
            v-if="coverImageUrl && postId"
            type="danger"
            plain
            @click="onClearCover"
          >
            Xóa ảnh bìa
          </el-button>
        </div>
      </div>

      <div class="form-section-title">Ảnh phía dưới</div>
      <p class="hint">Ảnh hiển thị dưới 4 ô thông tin trên trang tin — upload được ngay khi tạo.</p>
      <el-upload
        :show-file-list="false"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        :disabled="uploadingImages || saving"
        :before-upload="onImagesUpload"
      >
        <el-button type="primary" plain :loading="uploadingImages || saving">
          Thêm ảnh
        </el-button>
      </el-upload>

      <div v-if="contentImages.length" class="gallery-grid">
        <div v-for="img in contentImages" :key="img.id" class="gallery-item">
          <el-image
            :src="img.url"
            fit="cover"
            :preview-src-list="contentImages.map((i) => i.url)"
          />
          <div class="actions">
            <el-button size="small" link type="danger" @click="onDeleteImage(img)">
              Xóa
            </el-button>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.hint {
  margin: 0 0 12px;
  color: #6b7280;
  font-size: 0.85rem;
}

.zoom-hint {
  margin: 8px 0 0;
}

.main-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-start;
}

.main-preview {
  width: 200px;
  height: 150px;
  border-radius: 12px;
  overflow: hidden;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
}

.main-preview.empty {
  display: grid;
  place-items: center;
  color: #9ca3af;
  font-size: 0.85rem;
}

.main-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.gallery-item {
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
}

.gallery-item :deep(.el-image) {
  width: 100%;
  height: 110px;
}

.gallery-item .actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2px;
  padding: 4px 2px;
  background: #fff;
}
</style>
