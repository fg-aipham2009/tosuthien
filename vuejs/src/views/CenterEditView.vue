<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules, UploadRawFile } from 'element-plus';
import {
  fetchCenter,
  createCenter,
  updateCenter,
  uploadCenterMain,
  clearCenterMainImage,
  uploadCenterGallery,
  removeGalleryImage,
  fetchCourses,
  createCourse,
  updateCourse,
  deleteCourse,
} from '@/api/centers';
import type { Course, CourseFormData, GalleryImage } from '@/types/models';

const route = useRoute();
const router = useRouter();

const isNew = computed(() => route.name === 'center-new');
const centerId = computed(() => (isNew.value ? null : String(route.params.id)));

const saving = ref(false);
const loading = ref(false);
const formRef = ref<FormInstance>();

const form = reactive({
  templeName: '',
  slug: '',
  abbotName: '',
  abbotRank: '',
  abbotTitle: '',
  orgRole: '',
  genderSection: '',
  region: '',
  countryCode: '',
  province: '',
  address: '',
  phone: '',
  abbotPhone: '',
  googleMapsUrl: '',
  lat: null as number | null,
  lng: null as number | null,
  activityHours: '',
  rules: '',
  customs: '',
  detailContent: '',
  sortOrder: 0,
  isPublished: true,
});

const mainImageUrl = ref<string | null>(null);
const gallery = ref<GalleryImage[]>([]);
const courses = ref<Course[]>([]);
const uploadingMain = ref(false);
const uploadingGallery = ref(false);

const IMAGE_MAX = 15 * 1024 * 1024;
const IMAGE_OK = /\.(jpe?g|png|webp|gif)$/i;

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

const courseDialog = ref(false);
const editingCourse = ref<Course | null>(null);
const courseForm = reactive<CourseFormData>({
  title: '',
  type: 'REGULAR',
  recurrence: 'ONCE',
  startDate: '',
  endDate: '',
  dayStart: null,
  dayEnd: null,
  weekday: null,
  scheduleText: '',
  contact: '',
  description: '',
  sortOrder: 0,
});

const rules: FormRules = {
  templeName: [{ required: true, message: 'Nhập tên thiền viện', trigger: 'blur' }],
};

function parseGallery(raw: unknown): GalleryImage[] {
  if (Array.isArray(raw)) return raw as GalleryImage[];
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as GalleryImage[];
    } catch {
      return [];
    }
  }
  return [];
}

async function loadCenter() {
  if (!centerId.value) return;
  loading.value = true;
  try {
    const c = await fetchCenter(centerId.value);
    form.templeName = c.templeName;
    form.slug = c.slug ?? '';
    form.abbotName = c.abbotName ?? '';
    form.abbotRank = c.abbotRank ?? '';
    form.abbotTitle = c.abbotTitle ?? '';
    form.orgRole = c.orgRole ?? '';
    form.genderSection = c.genderSection ?? '';
    form.region = c.region ?? '';
    form.countryCode = c.countryCode ?? '';
    form.province = c.province ?? '';
    form.address = c.address ?? '';
    form.phone = c.phone ?? '';
    form.abbotPhone = c.abbotPhone ?? '';
    form.googleMapsUrl = c.googleMapsUrl ?? '';
    form.lat = c.lat;
    form.lng = c.lng;
    form.activityHours = c.activityHours ?? '';
    form.rules = c.rules ?? '';
    form.customs = c.customs ?? '';
    form.detailContent = c.detailContent ?? '';
    form.sortOrder = c.sortOrder;
    form.isPublished = c.isPublished;
    mainImageUrl.value = c.mainImageUrl;
    gallery.value = parseGallery(c.galleryImages);
    courses.value = c.courses ?? await fetchCourses(centerId.value);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Không tải được dữ liệu');
  } finally {
    loading.value = false;
  }
}

function buildPayload() {
  return {
    templeName: form.templeName.trim(),
    slug: form.slug.trim() || undefined,
    abbotName: form.abbotName.trim() || undefined,
    abbotRank: form.abbotRank.trim() || undefined,
    abbotTitle: form.abbotTitle.trim() || undefined,
    orgRole: form.orgRole.trim() || undefined,
    genderSection: form.genderSection || undefined,
    region: form.region || undefined,
    countryCode: form.countryCode.trim() || undefined,
    province: form.province.trim() || undefined,
    address: form.address.trim() || undefined,
    phone: form.phone.trim() || undefined,
    abbotPhone: form.abbotPhone.trim() || undefined,
    googleMapsUrl: form.googleMapsUrl.trim() || undefined,
    lat: form.lat ?? undefined,
    lng: form.lng ?? undefined,
    activityHours: form.activityHours.trim() || undefined,
    rules: form.rules.trim() || undefined,
    customs: form.customs.trim() || undefined,
    detailContent: form.detailContent.trim() || undefined,
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
      const created = await createCenter(buildPayload());
      ElMessage.success('Đã tạo thiền viện');
      router.replace(`/centers/${created.id}`);
    } else if (centerId.value) {
      await updateCenter(centerId.value, buildPayload());
      ElMessage.success('Đã lưu');
      await loadCenter();
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Lưu thất bại');
  } finally {
    saving.value = false;
  }
}

async function onMainUpload(file: UploadRawFile) {
  if (!centerId.value || !assertImage(file)) return false;
  uploadingMain.value = true;
  try {
    const updated = await uploadCenterMain(centerId.value, file);
    mainImageUrl.value = updated.mainImageUrl;
    ElMessage.success('Đã cập nhật ảnh chính');
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Upload thất bại');
  } finally {
    uploadingMain.value = false;
  }
  return false;
}

async function onClearMain() {
  if (!centerId.value || !mainImageUrl.value) return;
  try {
    await ElMessageBox.confirm('Xóa ảnh đại diện?', 'Xác nhận', { type: 'warning' });
    await clearCenterMainImage(centerId.value);
    mainImageUrl.value = null;
    ElMessage.success('Đã xóa ảnh đại diện');
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(e instanceof Error ? e.message : 'Xóa thất bại');
    }
  }
}

async function onGalleryUpload(file: UploadRawFile) {
  if (!centerId.value || !assertImage(file)) return false;
  uploadingGallery.value = true;
  try {
    const updated = await uploadCenterGallery(centerId.value, [file]);
    gallery.value = parseGallery(updated.galleryImages);
    ElMessage.success('Đã thêm ảnh');
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Upload thất bại');
  } finally {
    uploadingGallery.value = false;
  }
  return false;
}

async function onRemoveGallery(url: string) {
  if (!centerId.value) return;
  try {
    await ElMessageBox.confirm('Xóa ảnh này?', 'Xác nhận', { type: 'warning' });
    await removeGalleryImage(centerId.value, url);
    gallery.value = gallery.value.filter((g) => g.url !== url);
    ElMessage.success('Đã xóa ảnh');
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(e instanceof Error ? e.message : 'Xóa thất bại');
    }
  }
}

function openCourseDialog(course?: Course) {
  editingCourse.value = course ?? null;
  courseForm.title = course?.title ?? '';
  courseForm.type = course?.type ?? undefined;
  courseForm.recurrence = course?.recurrence ?? undefined;
  courseForm.startDate = course?.startDate?.slice(0, 10) ?? '';
  courseForm.endDate = course?.endDate?.slice(0, 10) ?? '';
  courseForm.dayStart = course?.dayStart ?? null;
  courseForm.dayEnd = course?.dayEnd ?? null;
  courseForm.weekday = course?.weekday ?? null;
  courseForm.scheduleText = course?.scheduleText ?? '';
  courseForm.contact = course?.contact ?? '';
  courseForm.description = course?.description ?? '';
  courseForm.sortOrder = course?.sortOrder ?? 0;
  courseDialog.value = true;
}

async function saveCourse() {
  if (!centerId.value || !courseForm.title.trim()) {
    ElMessage.warning('Nhập tên khoá tu');
    return;
  }
  try {
    const payload: CourseFormData = {
      title: courseForm.title.trim(),
      type: courseForm.type || undefined,
      recurrence: courseForm.recurrence || undefined,
      centerId: centerId.value,
      startDate: courseForm.startDate || undefined,
      endDate: courseForm.endDate || undefined,
      dayStart: courseForm.dayStart ?? undefined,
      dayEnd: courseForm.dayEnd ?? undefined,
      weekday: courseForm.weekday ?? undefined,
      scheduleText: courseForm.scheduleText?.trim() || undefined,
      contact: courseForm.contact?.trim() || undefined,
      description: courseForm.description?.trim() || undefined,
      sortOrder: courseForm.sortOrder ?? 0,
    };
    if (editingCourse.value) {
      await updateCourse(editingCourse.value.id, payload);
    } else {
      await createCourse(payload);
    }
    courseDialog.value = false;
    courses.value = await fetchCourses(centerId.value);
    ElMessage.success('Đã lưu khoá tu');
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Lưu khoá tu thất bại');
  }
}

async function onDeleteCourse(course: Course) {
  try {
    await ElMessageBox.confirm(`Xóa khoá "${course.title}"?`, 'Xác nhận', { type: 'warning' });
    await deleteCourse(course.id);
    courses.value = courses.value.filter((c) => c.id !== course.id);
    ElMessage.success('Đã xóa khoá tu');
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(e instanceof Error ? e.message : 'Xóa thất bại');
    }
  }
}

function goBack() {
  router.push('/centers');
}

onMounted(loadCenter);
watch(() => route.params.id, loadCenter);
</script>

<template>
  <div v-loading="loading">
    <div class="page-header">
      <h1>{{ isNew ? 'Thêm thiền viện / thiền đường' : 'Chỉnh sửa nội dung' }}</h1>
      <div>
        <el-button @click="goBack">Quay lại</el-button>
        <el-button type="primary" :loading="saving" @click="save">Lưu</el-button>
      </div>
    </div>

    <el-card shadow="never">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="140px" label-position="top">
        <el-row :gutter="20">
          <el-col :xs="24" :md="12">
            <el-form-item label="Tên thiền viện / thiền đường" prop="templeName">
              <el-input v-model="form.templeName" placeholder="VD: Thiền viện Trúc Lâm..." />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="Slug (URL)">
              <el-input v-model="form.slug" placeholder="Tự tạo nếu để trống" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="Trụ trì / liên hệ">
              <el-input v-model="form.abbotName" placeholder="Thích ..." />
            </el-form-item>
          </el-col>
          <el-col :xs="12" :md="6">
            <el-form-item label="Phẩm vị">
              <el-select v-model="form.abbotRank" clearable placeholder="HT / TT / ĐĐ / NS / SC" style="width: 100%">
                <el-option label="HT" value="HT" />
                <el-option label="TT" value="TT" />
                <el-option label="ĐĐ" value="ĐĐ" />
                <el-option label="NS" value="NS" />
                <el-option label="SC" value="SC" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="12" :md="6">
            <el-form-item label="Chức vụ tại chùa">
              <el-input v-model="form.abbotTitle" placeholder="Trụ trì, Viện chủ..." />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="Chức vụ tổ chức">
              <el-input v-model="form.orgRole" placeholder="Chứng minh, Phó, TBTK..." />
            </el-form-item>
          </el-col>
          <el-col :xs="12" :md="6">
            <el-form-item label="Chư Tăng / Ni">
              <el-select v-model="form.genderSection" clearable style="width: 100%">
                <el-option label="Chư Tăng" value="TANG" />
                <el-option label="Chư Ni" value="NI" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="12" :md="6">
            <el-form-item label="Vùng">
              <el-select v-model="form.region" clearable placeholder="Chọn sau" style="width: 100%">
                <el-option label="Bắc" value="BAC" />
                <el-option label="Trung" value="TRUNG" />
                <el-option label="Nam" value="NAM" />
                <el-option label="Nước ngoài" value="NUOC_NGOAI" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="12" :md="6">
            <el-form-item label="Tỉnh / TP">
              <el-input v-model="form.province" />
            </el-form-item>
          </el-col>
          <el-col :xs="12" :md="6">
            <el-form-item label="Mã quốc gia">
              <el-input v-model="form.countryCode" placeholder="VN" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="Điện thoại">
              <el-input v-model="form.phone" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="Địa chỉ">
          <el-input v-model="form.address" type="textarea" :rows="2" placeholder="Có thể bổ sung sau" />
        </el-form-item>

        <el-row :gutter="20">
          <el-col :xs="24" :md="12">
            <el-form-item label="Google Maps URL">
              <el-input v-model="form.googleMapsUrl" />
            </el-form-item>
          </el-col>
          <el-col :xs="12" :md="6">
            <el-form-item label="Vĩ độ (lat)">
              <el-input-number v-model="form.lat" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :xs="12" :md="6">
            <el-form-item label="Kinh độ (lng)">
              <el-input-number v-model="form.lng" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="Giờ sinh hoạt">
          <el-input v-model="form.activityHours" type="textarea" :rows="2" />
        </el-form-item>

        <el-form-item label="Nội quy">
          <el-input v-model="form.rules" type="textarea" :rows="4" />
        </el-form-item>

        <el-form-item label="Tập tục / lưu ý">
          <el-input v-model="form.customs" type="textarea" :rows="3" />
        </el-form-item>

        <el-form-item label="Nội dung chi tiết (thiền đường)">
          <el-input
            v-model="form.detailContent"
            type="textarea"
            :rows="8"
            placeholder="Giới thiệu, hướng dẫn tham quan, lịch tu..."
          />
        </el-form-item>

        <el-row :gutter="20">
          <el-col :xs="12" :md="6">
            <el-form-item label="Thứ tự hiển thị">
              <el-input-number v-model="form.sortOrder" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :xs="12" :md="6">
            <el-form-item label="Công khai">
              <el-switch v-model="form.isPublished" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <template v-if="!isNew && centerId">
        <div class="form-section-title">Ảnh đại diện</div>
        <p class="hint">JPG / PNG / WEBP / GIF · tối đa 15MB. Ảnh này hiện trên danh sách và trang chi tiết.</p>
        <div class="main-row">
          <el-image
            v-if="mainImageUrl"
            :src="mainImageUrl"
            fit="cover"
            class="main-preview"
            :preview-src-list="[mainImageUrl]"
          />
          <div v-else class="main-preview empty">Chưa có ảnh</div>
          <div class="main-actions">
            <el-upload
              :show-file-list="false"
              accept="image/jpeg,image/png,image/webp,image/gif"
              :disabled="uploadingMain"
              :before-upload="onMainUpload"
            >
              <el-button type="primary" :loading="uploadingMain">
                {{ mainImageUrl ? 'Đổi ảnh chính' : 'Upload ảnh chính' }}
              </el-button>
            </el-upload>
            <el-button v-if="mainImageUrl" type="danger" plain @click="onClearMain">Xóa ảnh</el-button>
          </div>
        </div>

        <div class="form-section-title">Thư viện ảnh</div>
        <p class="hint">Thêm nhiều ảnh gallery cho trang chi tiết thiền đường.</p>
        <el-upload
          :show-file-list="false"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          :disabled="uploadingGallery"
          :before-upload="onGalleryUpload"
        >
          <el-button type="primary" plain :loading="uploadingGallery">Thêm ảnh gallery</el-button>
        </el-upload>
        <div v-if="gallery.length" class="gallery-grid">
          <div v-for="img in gallery" :key="img.url" class="gallery-item">
            <el-image :src="img.url" fit="cover" :preview-src-list="gallery.map((g) => g.url)" />
            <div class="actions">
              <el-button size="small" type="danger" link @click="onRemoveGallery(img.url)">Xóa</el-button>
            </div>
          </div>
        </div>

        <div class="form-section-title">Khoá tu / hoạt động</div>
        <el-button type="primary" plain size="small" @click="openCourseDialog()">Thêm khoá tu</el-button>
        <el-table :data="courses" size="small" style="margin-top: 12px">
          <el-table-column prop="title" label="Tên khoá" />
          <el-table-column prop="type" label="Loại" width="100" />
          <el-table-column prop="scheduleText" label="Lịch" width="120" show-overflow-tooltip />
          <el-table-column prop="startDate" label="Bắt đầu" width="110" />
          <el-table-column prop="endDate" label="Kết thúc" width="110" />
          <el-table-column prop="contact" label="Liên hệ" show-overflow-tooltip />
          <el-table-column label="" width="120">
            <template #default="{ row }">
              <el-button link type="primary" @click="openCourseDialog(row)">Sửa</el-button>
              <el-button link type="danger" @click="onDeleteCourse(row)">Xóa</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>

      <el-alert
        v-else
        type="info"
        :closable="false"
        show-icon
        title="Lưu thông tin cơ bản trước, sau đó upload ảnh và thêm khoá tu."
        style="margin-top: 16px"
      />
    </el-card>

    <el-dialog v-model="courseDialog" :title="editingCourse ? 'Sửa khoá tu' : 'Thêm khoá tu'" width="560px">
      <el-form label-position="top">
        <el-form-item label="Tên khoá tu" required>
          <el-input v-model="courseForm.title" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="Loại">
              <el-select v-model="courseForm.type" clearable placeholder="Chọn sau" style="width: 100%">
                <el-option label="Khóa tu thường" value="REGULAR" />
                <el-option label="Mùa xuân" value="SPRING" />
                <el-option label="Mùa đông" value="WINTER" />
                <el-option label="An cư" value="AN_CU" />
                <el-option label="Khác" value="OTHER" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Chu kỳ">
              <el-select v-model="courseForm.recurrence" clearable placeholder="Chọn sau" style="width: 100%">
                <el-option label="Một lần" value="ONCE" />
                <el-option label="Hàng tuần" value="WEEKLY" />
                <el-option label="Khoảng ngày/tháng" value="MONTHLY_RANGE" />
                <el-option label="Hàng năm" value="YEARLY" />
                <el-option label="Tự tu" value="SELF_PRACTICE" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="Lịch (text gốc)">
          <el-input v-model="courseForm.scheduleText" placeholder="VD: 10-16, CN/Tuần, 8/4-4/7" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="Ngày bắt đầu">
              <el-date-picker v-model="courseForm.startDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Ngày kết thúc">
              <el-date-picker v-model="courseForm.endDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="Ngày bắt đầu (trong tháng)">
              <el-input-number v-model="courseForm.dayStart" :min="1" :max="31" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="Ngày kết thúc">
              <el-input-number v-model="courseForm.dayEnd" :min="1" :max="31" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="Thứ (0=CN)">
              <el-input-number v-model="courseForm.weekday" :min="0" :max="6" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="Liên hệ">
          <el-input v-model="courseForm.contact" />
        </el-form-item>
        <el-form-item label="Mô tả">
          <el-input v-model="courseForm.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="courseDialog = false">Huỷ</el-button>
        <el-button type="primary" @click="saveCourse">Lưu</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.page-header h1 {
  margin: 0;
  font-size: 1.25rem;
}

.form-section-title {
  margin: 28px 0 8px;
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  border-top: 1px solid #e5e7eb;
  padding-top: 20px;
}

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
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.gallery-item {
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  aspect-ratio: 4 / 3;
  background: #f9fafb;
}

.gallery-item :deep(.el-image) {
  width: 100%;
  height: 100%;
}

.gallery-item .actions {
  position: absolute;
  right: 4px;
  bottom: 4px;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 6px;
  padding: 0 4px;
}
</style>
