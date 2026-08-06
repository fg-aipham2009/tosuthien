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
import type { PostCategory, PostFormData, PostImage } from '@/types/models';

const route = useRoute();
const router = useRouter();

const isNew = computed(() => route.name === 'post-new');
const postId = computed(() => (isNew.value ? null : String(route.params.id)));

const saving = ref(false);
const loading = ref(false);
const formRef = ref<FormInstance>();
const categories = ref<PostCategory[]>([]);

const form = reactive({
  title: '',
  slug: '',
  categoryIds: [] as string[],
  excerpt: '',
  content: '',
  authorName: '',
  publishedAt: null as string | null,
  seoTitle: '',
  seoDescription: '',
  isPinned: false,
  sortOrder: 0,
  isPublished: true,
});

const coverImageUrl = ref<string | null>(null);
const images = ref<PostImage[]>([]);
const contentImages = computed(() => images.value.filter((image) => image.role !== 'cover'));
const uploadingCover = ref(false);
const uploadingImages = ref(false);

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

function applyPost(p: Awaited<ReturnType<typeof fetchPost>>) {
  form.title = p.title ?? '';
  form.slug = p.slug ?? '';
  form.categoryIds = (p.categories ?? []).map((c) => c.id);
  form.excerpt = p.excerpt ?? '';
  form.content = p.content ?? '';
  form.authorName = p.authorName ?? '';
  form.publishedAt = p.publishedAt ? p.publishedAt.slice(0, 19) : null;
  form.seoTitle = p.seoTitle ?? '';
  form.seoDescription = p.seoDescription ?? '';
  form.isPinned = p.isPinned ?? false;
  form.sortOrder = p.sortOrder ?? 0;
  form.isPublished = p.isPublished ?? true;
  coverImageUrl.value = p.coverImageUrl;
  images.value = p.images ?? [];
}

async function loadCategories() {
  try {
    categories.value = await fetchPostCategories();
  } catch {
    categories.value = [];
  }
}

async function loadPost() {
  if (!postId.value) return;
  loading.value = true;
  try {
    const p = await fetchPost(postId.value);
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
    slug: form.slug.trim() || undefined,
    categoryIds: form.categoryIds,
    excerpt: form.excerpt.trim() || undefined,
    content: form.content.trim() || undefined,
    authorName: form.authorName.trim() || undefined,
    publishedAt: form.publishedAt || null,
    seoTitle: form.seoTitle.trim() || undefined,
    seoDescription: form.seoDescription.trim() || undefined,
    isPinned: form.isPinned,
    sortOrder: form.sortOrder,
    isPublished: form.isPublished,
  };
}

async function save() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  saving.value = true;
  try {
    if (isNew.value) {
      const created = await createPost(buildPayload());
      ElMessage.success('Đã tạo bài viết');
      router.replace(`/posts/${created.id}`);
    } else if (postId.value) {
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
  if (!postId.value || !assertImage(file)) return false;
  uploadingCover.value = true;
  try {
    const updated = await uploadPostCover(postId.value, file);
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
  if (!postId.value || !assertImage(file)) return false;
  uploadingImages.value = true;
  try {
    const updated = await uploadPostImages(postId.value, [file]);
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

async function copyUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    ElMessage.success('Đã copy URL');
  } catch {
    ElMessage.warning('Không copy được URL');
  }
}

function insertImageIntoContent(url: string) {
  const tag = `<img src="${url}" alt="" />`;
  if (form.content.trim()) {
    form.content = `${form.content.trim()}\n${tag}`;
  } else {
    form.content = tag;
  }
  ElMessage.success('Đã chèn ảnh vào nội dung');
}

function goBack() {
  router.push('/posts');
}

onMounted(async () => {
  await loadCategories();
  await loadPost();
});

watch(() => route.params.id, loadPost);
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
        <el-row :gutter="20">
          <el-col :xs="24" :md="16">
            <el-form-item label="Tiêu đề" prop="title">
              <el-input v-model="form.title" placeholder="Tiêu đề bài viết" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="8">
            <el-form-item label="Slug (URL)">
              <el-input v-model="form.slug" placeholder="Tự tạo nếu để trống" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="Danh mục">
          <el-select
            v-model="form.categoryIds"
            multiple
            clearable
            filterable
            placeholder="Chọn danh mục"
            style="width: 100%"
          >
            <el-option
              v-for="c in categories"
              :key="c.id"
              :label="c.name"
              :value="c.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="Tóm tắt">
          <el-input v-model="form.excerpt" type="textarea" :rows="3" />
        </el-form-item>

        <el-form-item label="Nội dung (HTML)">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="16"
            class="content-html"
            placeholder="Nội dung HTML..."
          />
        </el-form-item>

        <el-row :gutter="20">
          <el-col :xs="24" :md="8">
            <el-form-item label="Tác giả">
              <el-input v-model="form.authorName" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="8">
            <el-form-item label="Ngày đăng">
              <el-date-picker
                v-model="form.publishedAt"
                type="datetime"
                value-format="YYYY-MM-DDTHH:mm:ss"
                placeholder="Chọn ngày giờ"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="12" :md="4">
            <el-form-item label="Thứ tự">
              <el-input-number v-model="form.sortOrder" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :xs="12" :md="4">
            <el-form-item label="Ghim">
              <el-switch v-model="form.isPinned" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :xs="24" :md="12">
            <el-form-item label="SEO title">
              <el-input v-model="form.seoTitle" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="Công khai">
              <el-switch v-model="form.isPublished" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="SEO description">
          <el-input v-model="form.seoDescription" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>

      <template v-if="!isNew && postId">
        <div class="form-section-title">Ảnh bìa</div>
        <p class="hint">JPG / PNG / WEBP / GIF · tối đa 15MB. Lưu bài trước rồi mới upload.</p>
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
              :disabled="uploadingCover"
              :before-upload="onCoverUpload"
            >
              <el-button type="primary" :loading="uploadingCover">
                {{ coverImageUrl ? 'Đổi ảnh bìa' : 'Upload ảnh bìa' }}
              </el-button>
            </el-upload>
            <el-button v-if="coverImageUrl" type="danger" plain @click="onClearCover">
              Xóa ảnh bìa
            </el-button>
          </div>
        </div>

        <div class="form-section-title">Ảnh nội dung</div>
        <p class="hint">Upload nhiều ảnh rồi chèn / copy URL vào HTML nội dung.</p>
        <el-upload
          :show-file-list="false"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          :disabled="uploadingImages"
          :before-upload="onImagesUpload"
        >
          <el-button type="primary" plain :loading="uploadingImages">Thêm ảnh</el-button>
        </el-upload>

        <div v-if="contentImages.length" class="gallery-grid">
          <div v-for="img in contentImages" :key="img.id" class="gallery-item">
            <el-image
              :src="img.url"
              fit="cover"
              :preview-src-list="contentImages.map((i) => i.url)"
            />
            <div class="actions">
              <el-button size="small" link type="primary" @click="insertImageIntoContent(img.url)">
                Chèn
              </el-button>
              <el-button size="small" link @click="copyUrl(img.url)">URL</el-button>
              <el-button size="small" link type="danger" @click="onDeleteImage(img)">Xóa</el-button>
            </div>
          </div>
        </div>
      </template>

      <el-alert
        v-else
        type="info"
        :closable="false"
        show-icon
        title="Lưu thông tin cơ bản trước, sau đó upload ảnh bìa và ảnh nội dung."
        style="margin-top: 16px"
      />
    </el-card>
  </div>
</template>

<style scoped>
.hint {
  margin: 0 0 12px;
  color: #6b7280;
  font-size: 0.85rem;
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

.content-html :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.45;
}
</style>
