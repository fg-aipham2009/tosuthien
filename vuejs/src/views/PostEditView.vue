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
  setPostCoverUrl,
  uploadPostImages,
  deletePostImage,
} from '@/api/posts';
import { fetchZoomRooms } from '@/api/zoom-rooms';
import { fetchTeachers } from '@/api/teachers';
import { fetchCenters } from '@/api/centers';
import PostBodyEditor from '@/components/PostBodyEditor.vue';
import type {
  Center,
  PostCategory,
  PostFormData,
  PostImage,
  Teacher,
  ZoomRoom,
} from '@/types/models';

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
const teachers = ref<Teacher[]>([]);
const centers = ref<Center[]>([]);
const teacherId = ref<string | null>(null);
const centerId = ref<string | null>(null);
const applyingCover = ref(false);
/** Cover to apply after the post is first created. */
const pendingCover = ref<string | null>(null);

const form = reactive({
  title: '',
  categoryIds: [] as string[],
  publishedAt: null as string | null,
  isPublished: true,
  sortOrder: 0,
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
const bodyEditorRef = ref<{ insertImages: (urls: string[]) => void; saveSelection: () => void } | null>(
  null,
);
const inlineFileRef = ref<HTMLInputElement | null>(null);
let embedInBody = false;

/** Class: teacher + schedule. Center: pick thiền đường banner. News: topic/body/zoom/images. */
type PostKind = 'news' | 'class' | 'center';
const postKind = ref<PostKind>('news');
const isClassNotice = computed(() => postKind.value === 'class');
const isCenterNotice = computed(() => postKind.value === 'center');
const isNews = computed(() => postKind.value === 'news');

const selectedZoomHint = computed(() => {
  const room = zoomRooms.value.find((z) => z.id === form.zoomRoomId);
  if (!room) return '';
  return `ID: ${room.meetingId}${room.pass ? ` · Pass: ${room.pass}` : ''}`;
});

const selectedTeacher = computed(() =>
  teachers.value.find((t) => t.id === teacherId.value) || null,
);

const selectedCenter = computed(() =>
  centers.value.find((c) => c.id === centerId.value) || null,
);

function teacherLabel(t: Teacher) {
  return [t.rank, t.name].filter(Boolean).join(' ');
}

function matchTeacherId(text: string | null | undefined): string | null {
  const raw = (text || '').trim().toLowerCase();
  if (!raw) return null;
  const exact = teachers.value.find((t) => teacherLabel(t).toLowerCase() === raw);
  if (exact) return exact.id;
  const byName = teachers.value.find((t) => {
    const name = t.name.toLowerCase();
    return raw.includes(name) || name.includes(raw);
  });
  return byName?.id || null;
}

const IMAGE_MAX = 15 * 1024 * 1024;
const IMAGE_OK = /\.(jpe?g|png|webp|gif)$/i;

const rules: FormRules = {};

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

function htmlFromDescription(raw: string) {
  const text = (raw || '').trim();
  if (!text) return '';
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function textFromHtml(html: string) {
  return html
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  form.sortOrder = p.sortOrder ?? 0;
  form.topicText = p.topicText ?? '';
  form.teacherText = p.teacherText ?? '';
  teacherId.value = matchTeacherId(p.teacherText);
  form.scheduleText = p.scheduleText ?? '';
  form.zoomRoomId =
    p.zoomRoomId ||
    zoomRooms.value.find(
      (z) => z.meetingId === (p.zoomMeetingId || '').replace(/\s/g, ''),
    )?.id ||
    null;
  form.description = htmlFromDescription(p.description ?? p.content ?? '');
  coverImageUrl.value = p.coverImageUrl;
  images.value = p.images ?? [];
  centerId.value = matchCenterId(p);
  if (p.kind === 'class' || (p.teacherText || '').trim() || (p.scheduleText || '').trim()) {
    postKind.value = 'class';
  } else if (p.kind === 'center' || centerId.value) {
    postKind.value = 'center';
  } else {
    postKind.value = 'news';
  }
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

async function loadTeachers() {
  try {
    teachers.value = await fetchTeachers(true);
    if (!teacherId.value && form.teacherText) {
      teacherId.value = matchTeacherId(form.teacherText);
    }
  } catch {
    teachers.value = [];
  }
}

async function loadCenters() {
  try {
    centers.value = await fetchCenters(true);
  } catch {
    centers.value = [];
  }
}

function matchCenterId(p: {
  coverImageUrl?: string | null;
  title?: string | null;
  topicText?: string | null;
}): string | null {
  const cover = (p.coverImageUrl || '').trim();
  if (cover) {
    const byCover = centers.value.find((c) => (c.mainImageUrl || '').trim() === cover);
    if (byCover) return byCover.id;
  }
  const hay = `${p.title || ''} ${p.topicText || ''}`.toLowerCase();
  if (!hay.trim()) return null;
  const byName = centers.value.find((c) => {
    const name = (c.templeName || '').trim().toLowerCase();
    return name && hay.includes(name);
  });
  return byName?.id || null;
}

async function applyCover(
  photoUrl: string | null | undefined,
  successMsg: string,
  errorMsg: string,
) {
  if (!photoUrl?.trim()) return;
  const id = postId.value;
  if (!id) {
    pendingCover.value = photoUrl.trim();
    return;
  }
  applyingCover.value = true;
  try {
    const updated = await setPostCoverUrl(id, photoUrl.trim());
    coverImageUrl.value = updated.coverImageUrl;
    images.value = updated.images ?? images.value;
    pendingCover.value = null;
    ElMessage.success(successMsg);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : errorMsg);
  } finally {
    applyingCover.value = false;
  }
}

async function flushPendingCover() {
  if (!pendingCover.value || !postId.value) return;
  await applyCover(pendingCover.value, 'Đã gắn ảnh bìa', 'Không gắn được ảnh bìa');
}

async function onTeacherChange(id: string | null) {
  teacherId.value = id;
  const t = teachers.value.find((x) => x.id === id);
  form.teacherText = t ? teacherLabel(t) : '';
  if (t?.photoUrl) {
    await applyCover(
      t.photoUrl,
      'Đã dùng ảnh giảng sư làm ảnh bìa',
      'Không gắn được ảnh giảng sư',
    );
  } else {
    pendingCover.value = null;
  }
}

async function onCenterChange(id: string | null) {
  centerId.value = id;
  const c = centers.value.find((x) => x.id === id);
  if (c?.mainImageUrl) {
    await applyCover(
      c.mainImageUrl,
      'Đã dùng ảnh thiền đường làm ảnh bìa',
      'Không gắn được ảnh thiền đường',
    );
  } else {
    pendingCover.value = null;
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
  const description = form.description.trim();
  return {
    title: form.title.trim(),
    kind: postKind.value,
    categoryIds: form.categoryIds.length
      ? form.categoryIds
      : defaultTinTucCategoryIds(),
    publishedAt: form.publishedAt || new Date().toISOString().slice(0, 19),
    isPublished: form.isPublished,
    sortOrder: form.sortOrder ?? 0,
    topicText: form.topicText.trim(),
    teacherText: isClassNotice.value ? form.teacherText.trim() : '',
    scheduleText: isClassNotice.value ? form.scheduleText.trim() : '',
    zoomRoomId: form.zoomRoomId,
    description,
    content: description,
  };
}

function hasPostBody(): boolean {
  return Boolean(
    form.title.trim() ||
      textFromHtml(form.description) ||
      /<img/i.test(form.description) ||
      form.topicText.trim() ||
      coverImageUrl.value ||
      contentImages.value.length ||
      (isClassNotice.value && (form.teacherText.trim() || form.scheduleText.trim())) ||
      (isCenterNotice.value && centerId.value),
  );
}

/** Create draft post when uploading images on the "new" screen. */
async function ensurePostId(): Promise<string | null> {
  if (postId.value) return postId.value;
  saving.value = true;
  try {
    const created = await createPost(buildPayload());
    activePostId.value = created.id;
    return created.id;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Không tạo được bài');
    return null;
  } finally {
    saving.value = false;
  }
}

async function save() {
  if (!hasPostBody() && !postId.value) {
    ElMessage.warning('Nhập nội dung hoặc thêm ảnh');
    return;
  }

  saving.value = true;
  try {
    if (!postId.value) {
      const created = await createPost(buildPayload());
      activePostId.value = created.id;
      applyPost(created);
      await flushPendingCover();
      ElMessage.success('Đã tạo bài viết');
      await router.replace(`/posts/${created.id}`);
    } else {
      const updated = await updatePost(postId.value, buildPayload());
      applyPost(updated);
      await flushPendingCover();
      if (route.name === 'post-new') {
        await router.replace(`/posts/${updated.id}`);
      }
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

const galleryQueue: UploadRawFile[] = [];
let galleryFlushTimer: ReturnType<typeof setTimeout> | null = null;

function onImagesUpload(file: UploadRawFile) {
  queueImageFiles([file]);
  return false;
}

function queueImageFiles(files: File[]) {
  let added = 0;
  for (const file of files) {
    if (!assertImage(file)) continue;
    galleryQueue.push(file as UploadRawFile);
    added += 1;
  }
  if (!added) return;
  if (galleryFlushTimer) clearTimeout(galleryFlushTimer);
  galleryFlushTimer = setTimeout(() => {
    galleryFlushTimer = null;
    void flushGalleryQueue();
  }, 30);
}

function onPasteImages(e: ClipboardEvent) {
  if (isNews.value) return;
  const files = [...(e.clipboardData?.files ?? [])].filter(
    (file) => file.type.startsWith('image/') || IMAGE_OK.test(file.name),
  );
  if (!files.length) return;
  e.preventDefault();
  queueImageFiles(files);
}

function pickInlineImages() {
  embedInBody = true;
  bodyEditorRef.value?.saveSelection();
  inlineFileRef.value?.click();
}

function onInlineFilesSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  embedInBody = true;
  queueImageFiles([...(input.files ?? [])]);
  input.value = '';
}

function onEditorFiles(files: File[]) {
  embedInBody = true;
  queueImageFiles(files);
}

async function flushGalleryQueue() {
  const files = galleryQueue.splice(0);
  if (!files.length) return;
  const putInBody = embedInBody;
  embedInBody = false;
  const urlsBefore = new Set(images.value.map((image) => image.url));
  const id = await ensurePostId();
  if (!id) {
    ElMessage.warning('Không tạo được bài để gắn ảnh');
    return;
  }
  uploadingImages.value = true;
  try {
    let rest = files;
    let updated: Awaited<ReturnType<typeof uploadPostImages>> | null = null;
    if (!putInBody && !coverImageUrl.value && rest.length) {
      const cover = rest[0];
      rest = rest.slice(1);
      updated = await uploadPostCover(id, cover);
      coverImageUrl.value = updated.coverImageUrl;
      images.value = updated.images ?? images.value;
    }
    if (rest.length) {
      updated = await uploadPostImages(id, rest);
    }
    if (updated) images.value = updated.images ?? [];
    if (putInBody) {
      const urls: string[] = [];
      for (const image of images.value) {
        if (!urlsBefore.has(image.url)) urls.push(image.url);
      }
      bodyEditorRef.value?.insertImages([...new Set(urls)]);
    }
    ElMessage.success(
      files.length > 1 ? `Đã thêm ${files.length} ảnh` : 'Đã thêm ảnh',
    );
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Upload thất bại');
  } finally {
    uploadingImages.value = false;
    if (galleryQueue.length) void flushGalleryQueue();
  }
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
  await Promise.all([loadCategories(), loadZoomRooms(), loadTeachers(), loadCenters()]);
  await loadPost();
});

watch(
  () => route.params.id,
  async (id) => {
    if (route.name === 'post-new') return;
    if (id && id === activePostId.value) return;
    activePostId.value = String(id || '') || null;
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

    <el-card shadow="never" @paste="onPasteImages">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="Loại bài">
          <el-radio-group v-model="postKind">
            <el-radio-button value="news">Tin tức / khoá tu</el-radio-button>
            <el-radio-button value="class">Thông báo lớp học</el-radio-button>
            <el-radio-button value="center">Thông báo thiền đường</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="Tiêu đề">
          <el-input
            v-model="form.title"
            :placeholder="
              isClassNotice
                ? 'VD: Thông báo lớp học chuyên đề …'
                : isCenterNotice
                  ? 'VD: Thông báo thiền đường …'
                  : 'Tuỳ chọn — để trống thì hệ thống tự đặt tiêu đề'
            "
          />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :xs="24" :md="12">
            <el-form-item label="Thứ tự hiển thị">
              <el-input-number
                v-model="form.sortOrder"
                :min="0"
                controls-position="right"
                style="width: 100%"
              />
              <p class="hint">Số nhỏ hơn lên trước; trùng thì theo ngày tạo mới hơn.</p>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="Công khai">
              <el-switch v-model="form.isPublished" />
            </el-form-item>
          </el-col>
        </el-row>

        <div class="form-section-title">{{ isNews ? 'Nội dung' : 'TIN TỨC' }}</div>

        <el-form-item :label="isNews ? 'Đề tài (tuỳ chọn)' : '1. Đề tài'">
          <el-input
            v-model="form.topicText"
            :placeholder="
              isClassNotice
                ? 'VD: Duy Lực Ngữ Lục 44'
                : isCenterNotice
                  ? 'VD: Thiền đường …'
                  : 'VD: Khoá tu Tổ Sư Thiền tại …'
            "
          />
        </el-form-item>

        <template v-if="isClassNotice">
          <el-row :gutter="16">
            <el-col :xs="24" :md="12">
              <el-form-item label="Giảng sư">
                <el-select
                  :model-value="teacherId"
                  clearable
                  filterable
                  placeholder="Chọn giảng sư"
                  style="width: 100%"
                  :disabled="applyingCover"
                  @change="onTeacherChange"
                >
                  <el-option
                    v-for="t in teachers"
                    :key="t.id"
                    :label="teacherLabel(t)"
                    :value="t.id"
                  >
                    <div class="teacher-option">
                      <el-avatar
                        v-if="t.photoUrl"
                        :src="t.photoUrl"
                        :size="28"
                        shape="circle"
                      />
                      <el-avatar v-else :size="28">{{ t.name.slice(0, 1) }}</el-avatar>
                      <span>{{ teacherLabel(t) }}</span>
                    </div>
                  </el-option>
                </el-select>
                <p class="hint">
                  Có ảnh giảng sư → dùng làm ảnh bìa. Chưa có ảnh → upload tay ở mục 4.
                </p>
                <div v-if="selectedTeacher?.photoUrl" class="teacher-photo-preview">
                  <el-image
                    :src="selectedTeacher.photoUrl"
                    fit="contain"
                    style="width: 96px; height: 96px; border-radius: 8px"
                  />
                </div>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :md="12">
              <el-form-item label="Thời gian">
                <el-input
                  v-model="form.scheduleText"
                  type="textarea"
                  :rows="3"
                  placeholder="Lịch học / ngày giờ"
                />
              </el-form-item>
            </el-col>
          </el-row>
        </template>

        <el-form-item v-if="isCenterNotice" label="Thiền đường">
          <el-select
            :model-value="centerId"
            clearable
            filterable
            placeholder="Chọn thiền đường"
            style="width: 100%"
            :disabled="applyingCover"
            @change="onCenterChange"
          >
            <el-option
              v-for="c in centers"
              :key="c.id"
              :label="c.templeName"
              :value="c.id"
            >
              <div class="teacher-option">
                <el-avatar
                  v-if="c.mainImageUrl"
                  :src="c.mainImageUrl"
                  :size="28"
                  shape="square"
                />
                <el-avatar v-else :size="28" shape="square">
                  {{ c.templeName.slice(0, 1) }}
                </el-avatar>
                <span>{{ c.templeName }}</span>
              </div>
            </el-option>
          </el-select>
          <p class="hint">
            Có ảnh đại diện thiền đường → dùng làm ảnh bìa. Chưa có ảnh → upload tay ở mục 4.
          </p>
          <div v-if="selectedCenter?.mainImageUrl" class="teacher-photo-preview">
            <el-image
              :src="selectedCenter.mainImageUrl"
              fit="contain"
              style="width: 160px; height: 96px; border-radius: 8px"
            />
          </div>
        </el-form-item>

        <el-form-item v-if="!isNews" :label="'2. Viết bài tin tức'">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="isClassNotice ? 3 : 10"
            :placeholder="
              isClassNotice
                ? 'Mô tả thêm (tuỳ chọn)'
                : 'Nội dung thông báo thiền đường…'
            "
          />
        </el-form-item>

        <el-form-item v-else label="Viết bài">
          <PostBodyEditor
            ref="bodyEditorRef"
            v-model="form.description"
            :disabled="uploadingImages || saving"
            @pick-images="pickInlineImages"
            @files="onEditorFiles"
          />
          <input
            ref="inlineFileRef"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            hidden
            @change="onInlineFilesSelected"
          />
        </el-form-item>

        <el-form-item v-if="!isNews" label="3. Phòng Zoom">
          <el-select
            v-model="form.zoomRoomId"
            clearable
            filterable
            placeholder="Chọn phòng Zoom (có thể bỏ trống)"
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
      </el-form>

      <div v-if="!isNews" class="form-section-title">4. Đăng nhiều hình ảnh</div>
      <template v-if="!isNews">
      <p class="hint">
        JPG / PNG / WEBP / GIF · tối đa 15MB.
        <template v-if="isCenterNotice">
          Ảnh bìa là banner thiền đường; bấm «Thêm nhiều ảnh» để hiện gallery trên trang tin.
        </template>
        <template v-else>
          Ảnh bìa hiện trên danh sách tin; ảnh khác hiện dưới bài.
        </template>
      </p>
      <div class="main-row">
        <el-image
          v-if="coverImageUrl"
          :key="coverImageUrl"
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

      <el-upload
        drag
        :show-file-list="false"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        :disabled="uploadingImages || saving"
        :before-upload="onImagesUpload"
        class="image-drop"
      >
        <div class="drop-copy">
          {{
            uploadingImages
              ? 'Đang tải ảnh…'
              : 'Kéo thả ảnh vào đây, dán Ctrl+V, hoặc bấm để chọn nhiều ảnh'
          }}
        </div>
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
      </template>

      <div v-if="isNews" class="form-section-title">Ảnh bìa (danh sách tin)</div>
      <div v-if="isNews" class="main-row">
        <el-image
          v-if="coverImageUrl"
          :key="coverImageUrl"
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
      <p v-if="isNews" class="hint">Tuỳ chọn. Ảnh trong bài dùng nút «Chèn ảnh vào bài» phía trên.</p>

      <el-form v-if="isNews" label-position="top" style="margin-top: 20px">
        <el-form-item label="Phòng Zoom (tuỳ chọn)">
          <el-select
            v-model="form.zoomRoomId"
            clearable
            filterable
            placeholder="Chọn phòng Zoom nếu tin có họp online"
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
      </el-form>
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

.image-drop {
  width: 100%;
}

.image-drop :deep(.el-upload-dragger) {
  padding: 28px 16px;
  border-radius: 12px;
}

.drop-copy {
  color: #6b7280;
  font-size: 0.95rem;
}

.teacher-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.teacher-photo-preview {
  margin-top: 8px;
}
</style>
