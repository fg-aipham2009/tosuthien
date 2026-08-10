<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules, UploadRequestOptions } from 'element-plus';
import {
  clearAnnouncementTeacherPhoto,
  createClassAnnouncement,
  deleteClassAnnouncement,
  fetchClassAnnouncements,
  fetchDharmaClasses,
  updateClassAnnouncement,
  updateDharmaClass,
  uploadAnnouncementTeacherPhoto,
} from '@/api/class-announcements';
import { fetchTeachers } from '@/api/teachers';
import type {
  ClassAnnouncement,
  ClassAnnouncementFormData,
  DharmaClass,
  Teacher,
} from '@/types/models';

const POSTER_BG = '/announcements/poster-bg.png';

const loading = ref(false);
const announcements = ref<ClassAnnouncement[]>([]);
const classes = ref<DharmaClass[]>([]);
const teachers = ref<Teacher[]>([]);
const filterClassId = ref('');

const dialog = ref(false);
const saving = ref(false);
const editing = ref<ClassAnnouncement | null>(null);
const formRef = ref<FormInstance>();
const form = reactive<ClassAnnouncementFormData>({
  classId: '',
  teacherId: null,
  templeName: 'TRƯỜNG HẠ CHÙA PHẬT ĐÀ',
  templeAddress: '362/46, Nguyễn Đình Chiểu, phường Bàn Cờ, Tp.HCM',
  topicTitle: '',
  formatNote: '(Học trực tiếp và Trực tuyến tối hàng tuần)',
  teacherNameText: '',
  sessionDate: null,
  lunarDateText: '',
  timeText: '',
  zoomMeetingId: '',
  zoomPass: '',
  zoomUrl: '',
  resourcesNote:
    'Xem lại bài giảng trên tosuthien.com · YouTube / TikTok / Fanpage: Tông Phong Tổ Sư Thiền',
  backgroundKey: 'default',
  sortOrder: 0,
  isPublished: true,
});

const classDialog = ref(false);
const classSaving = ref(false);
const editingClass = ref<DharmaClass | null>(null);
const classForm = reactive({
  name: '',
  shortName: '',
  timeText: '',
  zoomMeetingId: '',
  zoomPass: '',
  zoomUrl: '',
  defaultTeacherId: null as string | null,
});

const rules: FormRules = {
  classId: [{ required: true, message: 'Chọn lớp', trigger: 'change' }],
  topicTitle: [{ required: true, message: 'Nhập đề tài', trigger: 'blur' }],
};

const previewTeacherPhoto = computed(() => {
  if (editing.value?.teacherPhotoUrl) return editing.value.teacherPhotoUrl;
  const t = teachers.value.find((x) => x.id === form.teacherId);
  return t?.photoUrl || '';
});

const previewTeacherName = computed(() => {
  if (form.teacherNameText?.trim()) return form.teacherNameText.trim();
  const t = teachers.value.find((x) => x.id === form.teacherId);
  return t ? [t.rank, t.name].filter(Boolean).join(' ') : '';
});

async function load() {
  loading.value = true;
  try {
    const [a, c, t] = await Promise.all([
      fetchClassAnnouncements({
        all: true,
        classId: filterClassId.value || undefined,
      }),
      fetchDharmaClasses(true),
      fetchTeachers(true),
    ]);
    announcements.value = a;
    classes.value = c;
    teachers.value = t;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Không tải được dữ liệu');
  } finally {
    loading.value = false;
  }
}

function onFilter() {
  load();
}

function fillFromClass(classId: string) {
  const klass = classes.value.find((c) => c.id === classId);
  if (!klass) return;
  form.timeText = klass.timeText || '';
  form.zoomMeetingId = klass.zoomMeetingId || '';
  form.zoomPass = klass.zoomPass || '';
  form.zoomUrl = klass.zoomUrl || '';
  if (klass.defaultTeacherId) {
    form.teacherId = klass.defaultTeacherId;
    const t = teachers.value.find((x) => x.id === klass.defaultTeacherId);
    if (t) form.teacherNameText = [t.rank, t.name].filter(Boolean).join(' ');
  }
}

function openCreate() {
  editing.value = null;
  const first = classes.value[0];
  Object.assign(form, {
    classId: first?.id || '',
    teacherId: first?.defaultTeacherId || null,
    templeName: 'TRƯỜNG HẠ CHÙA PHẬT ĐÀ',
    templeAddress: '362/46, Nguyễn Đình Chiểu, phường Bàn Cờ, Tp.HCM',
    topicTitle: '',
    formatNote: '(Học trực tiếp và Trực tuyến tối hàng tuần)',
    teacherNameText: '',
    sessionDate: null,
    lunarDateText: '',
    timeText: '',
    zoomMeetingId: '',
    zoomPass: '',
    zoomUrl: '',
    resourcesNote:
      'Xem lại bài giảng trên tosuthien.com · YouTube / TikTok / Fanpage: Tông Phong Tổ Sư Thiền',
    backgroundKey: 'default',
    sortOrder: 0,
    isPublished: true,
  });
  if (first) fillFromClass(first.id);
  dialog.value = true;
}

function openEdit(row: ClassAnnouncement) {
  editing.value = row;
  Object.assign(form, {
    classId: row.classId,
    teacherId: row.teacherId,
    templeName: row.templeName,
    templeAddress: row.templeAddress || '',
    topicTitle: row.topicTitle,
    formatNote: row.formatNote || '',
    teacherNameText: row.teacherNameText || '',
    sessionDate: row.sessionDate ? String(row.sessionDate).slice(0, 10) : null,
    lunarDateText: row.lunarDateText || '',
    timeText: row.timeText || '',
    zoomMeetingId: row.zoomMeetingId || '',
    zoomPass: row.zoomPass || '',
    zoomUrl: row.zoomUrl || '',
    resourcesNote: row.resourcesNote || '',
    backgroundKey: row.backgroundKey || 'default',
    sortOrder: row.sortOrder,
    isPublished: row.isPublished,
  });
  dialog.value = true;
}

async function save() {
  const ok = await formRef.value?.validate().catch(() => false);
  if (!ok) return;
  saving.value = true;
  try {
    const payload: ClassAnnouncementFormData = {
      ...form,
      sessionDate: form.sessionDate || null,
    };
    if (editing.value) {
      editing.value = await updateClassAnnouncement(editing.value.id, payload);
      ElMessage.success('Đã cập nhật thông báo');
    } else {
      editing.value = await createClassAnnouncement(payload);
      ElMessage.success('Đã tạo thông báo');
    }
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Lưu thất bại');
  } finally {
    saving.value = false;
  }
}

async function onDelete(row: ClassAnnouncement) {
  try {
    await ElMessageBox.confirm(`Xóa thông báo「${row.topicTitle}」?`, 'Xác nhận', {
      type: 'warning',
    });
    await deleteClassAnnouncement(row.id);
    ElMessage.success('Đã xóa');
    await load();
  } catch {
    /* cancel */
  }
}

async function onUploadPhoto(opts: UploadRequestOptions) {
  if (!editing.value) {
    ElMessage.warning('Lưu thông báo trước rồi mới upload ảnh giảng sư cho poster');
    return;
  }
  try {
    editing.value = await uploadAnnouncementTeacherPhoto(
      editing.value.id,
      opts.file as File,
    );
    ElMessage.success('Đã cập nhật ảnh giảng sư trên poster');
    opts.onSuccess?.(editing.value);
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Upload lỗi');
    opts.onError?.(e as never);
  }
}

async function onClearPhoto() {
  if (!editing.value) return;
  editing.value = await clearAnnouncementTeacherPhoto(editing.value.id);
  ElMessage.success('Đã xóa ảnh poster');
  await load();
}

function openClassEdit(row: DharmaClass) {
  editingClass.value = row;
  Object.assign(classForm, {
    name: row.name,
    shortName: row.shortName || '',
    timeText: row.timeText || '',
    zoomMeetingId: row.zoomMeetingId || '',
    zoomPass: row.zoomPass || '',
    zoomUrl: row.zoomUrl || '',
    defaultTeacherId: row.defaultTeacherId,
  });
  classDialog.value = true;
}

async function saveClass() {
  if (!editingClass.value) return;
  classSaving.value = true;
  try {
    await updateDharmaClass(editingClass.value.id, { ...classForm });
    ElMessage.success('Đã cập nhật lớp học / Zoom');
    classDialog.value = false;
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Lưu lớp thất bại');
  } finally {
    classSaving.value = false;
  }
}

function classLabel(id: string) {
  return classes.value.find((c) => c.id === id)?.shortName
    || classes.value.find((c) => c.id === id)?.name
    || '—';
}

onMounted(load);
</script>

<template>
  <div>
    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="Loại 1 — Thông báo khóa học"
      description="Nền poster dùng chung. Admin chỉ đổi tên chùa, địa chỉ, đề tài, thời gian, Zoom và ảnh giảng sư."
      style="margin-bottom: 16px"
    />

    <div class="section-head">
      <h3>Danh sách 3 lớp học</h3>
    </div>
    <el-table :data="classes" border stripe size="small" style="margin-bottom: 24px">
      <el-table-column prop="sortOrder" label="#" width="50" />
      <el-table-column label="Lớp" min-width="260">
        <template #default="{ row }">
          <strong>{{ row.name }}</strong>
          <div class="muted">{{ row.code }}</div>
        </template>
      </el-table-column>
      <el-table-column label="Zoom" min-width="180">
        <template #default="{ row }">
          <div>ID: {{ row.zoomMeetingId || '—' }}</div>
          <div class="muted">pass: {{ row.zoomPass || '—' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="Giảng sư mặc định" min-width="160">
        <template #default="{ row }">
          {{
            row.defaultTeacher
              ? [row.defaultTeacher.rank, row.defaultTeacher.name].filter(Boolean).join(' ')
              : 'Các vị giáo thọ'
          }}
        </template>
      </el-table-column>
      <el-table-column label="" width="100">
        <template #default="{ row }">
          <el-button size="small" @click="openClassEdit(row)">Sửa Zoom</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="toolbar">
      <div>
        <h3 style="margin: 0">Thông báo khóa học</h3>
        <p class="hint">Tạo poster từng buổi: đề tài + ngày + ảnh giảng sư.</p>
      </div>
      <div class="toolbar-right">
        <el-select
          v-model="filterClassId"
          clearable
          placeholder="Lọc theo lớp"
          style="width: 260px"
          @change="onFilter"
        >
          <el-option
            v-for="c in classes"
            :key="c.id"
            :label="c.shortName || c.name"
            :value="c.id"
          />
        </el-select>
        <el-button type="primary" @click="openCreate">Thêm thông báo</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="announcements" border stripe>
      <el-table-column label="Ngày" width="120">
        <template #default="{ row }">
          {{ row.sessionDate ? String(row.sessionDate).slice(0, 10) : '—' }}
        </template>
      </el-table-column>
      <el-table-column label="Lớp" min-width="160">
        <template #default="{ row }">{{ classLabel(row.classId) }}</template>
      </el-table-column>
      <el-table-column prop="topicTitle" label="Đề tài" min-width="180" />
      <el-table-column label="Giảng sư" min-width="160">
        <template #default="{ row }">
          {{ row.teacherNameText || '—' }}
        </template>
      </el-table-column>
      <el-table-column label="Zoom" width="140">
        <template #default="{ row }">{{ row.zoomMeetingId || '—' }}</template>
      </el-table-column>
      <el-table-column label="TT" width="90">
        <template #default="{ row }">
          <el-tag :type="row.isPublished ? 'success' : 'info'" size="small">
            {{ row.isPublished ? 'Hiện' : 'Ẩn' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="" width="160" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openEdit(row)">Sửa</el-button>
          <el-button size="small" type="danger" @click="onDelete(row)">Xóa</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- Dialog thông báo + preview poster -->
    <el-dialog
      v-model="dialog"
      :title="editing ? 'Sửa thông báo khóa học' : 'Thêm thông báo khóa học'"
      width="980px"
      top="4vh"
      destroy-on-close
    >
      <div class="editor-grid">
        <el-form ref="formRef" :model="form" :rules="rules" label-width="130px">
          <el-form-item label="Lớp học" prop="classId">
            <el-select
              v-model="form.classId"
              style="width: 100%"
              @change="fillFromClass"
            >
              <el-option
                v-for="c in classes"
                :key="c.id"
                :label="c.name"
                :value="c.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="Tên chùa">
            <el-input v-model="form.templeName" />
          </el-form-item>
          <el-form-item label="Địa chỉ chùa">
            <el-input v-model="form.templeAddress" type="textarea" :rows="2" />
          </el-form-item>
          <el-form-item label="Đề tài" prop="topicTitle">
            <el-input v-model="form.topicTitle" placeholder="THIỀN CĂN BẢN 156" />
          </el-form-item>
          <el-form-item label="Dòng phụ">
            <el-input v-model="form.formatNote" />
          </el-form-item>
          <el-form-item label="Giảng sư">
            <el-select
              v-model="form.teacherId"
              clearable
              filterable
              style="width: 100%"
              @change="
                (id: string) => {
                  const t = teachers.find((x) => x.id === id);
                  if (t) form.teacherNameText = [t.rank, t.name].filter(Boolean).join(' ');
                }
              "
            >
              <el-option
                v-for="t in teachers"
                :key="t.id"
                :label="[t.rank, t.name].filter(Boolean).join(' ')"
                :value="t.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="Tên trên poster">
            <el-input v-model="form.teacherNameText" placeholder="Hoà thượng THÍCH MINH HIỀN" />
          </el-form-item>
          <el-form-item label="Ngày học">
            <el-date-picker
              v-model="form.sessionDate"
              type="date"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="Âm lịch">
            <el-input v-model="form.lunarDateText" placeholder="26/06/Bính Ngọ" />
          </el-form-item>
          <el-form-item label="Thời gian">
            <el-input
              v-model="form.timeText"
              placeholder="19h00 - 20h00 Tối thứ 7, ngày 08/08/2026"
            />
          </el-form-item>
          <el-form-item label="Zoom ID">
            <el-input v-model="form.zoomMeetingId" />
          </el-form-item>
          <el-form-item label="Zoom pass">
            <el-input v-model="form.zoomPass" />
          </el-form-item>
          <el-form-item label="Zoom URL">
            <el-input v-model="form.zoomUrl" />
          </el-form-item>
          <el-form-item label="Ghi chú tài liệu">
            <el-input v-model="form.resourcesNote" type="textarea" :rows="2" />
          </el-form-item>
          <el-form-item label="Ảnh giảng sư">
            <div class="photo-row">
              <el-upload
                :show-file-list="false"
                accept="image/*"
                :http-request="onUploadPhoto"
                :disabled="!editing"
              >
                <el-button :disabled="!editing">
                  {{ editing?.teacherPhotoUrl ? 'Đổi ảnh poster' : 'Upload ảnh poster' }}
                </el-button>
              </el-upload>
              <el-button
                v-if="editing?.teacherPhotoUrl"
                @click="onClearPhoto"
              >
                Xóa ảnh
              </el-button>
              <span v-if="!editing" class="muted">Lưu trước để upload ảnh</span>
            </div>
          </el-form-item>
          <el-form-item label="Công khai">
            <el-switch v-model="form.isPublished" />
          </el-form-item>
        </el-form>

        <div class="poster-preview" :style="{ backgroundImage: `url(${POSTER_BG})` }">
          <div class="poster-inner">
            <p class="p-temple">{{ form.templeName || 'TRƯỜNG HẠ CHÙA PHẬT ĐÀ' }}</p>
            <p class="p-addr">{{ form.templeAddress }}</p>
            <p class="p-label">THÔNG BÁO</p>
            <p class="p-title">LỚP {{ form.topicTitle || '…' }}</p>
            <p class="p-format">{{ form.formatNote }}</p>
            <p class="p-topic">Đề tài: {{ form.topicTitle || '—' }}</p>
            <p class="p-teacher">Chủ giảng: {{ previewTeacherName || '—' }}</p>
            <div v-if="previewTeacherPhoto" class="p-photo-wrap">
              <img :src="previewTeacherPhoto" alt="" class="p-photo" />
            </div>
            <div class="p-box">
              <p><strong>Thời gian:</strong> {{ form.timeText || '—' }}</p>
              <p v-if="form.lunarDateText">({{ form.lunarDateText }})</p>
              <p><strong>Zoom ID:</strong> {{ form.zoomMeetingId || '—' }}</p>
              <p><strong>Pass:</strong> {{ form.zoomPass || '—' }}</p>
            </div>
            <p class="p-note">{{ form.resourcesNote }}</p>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="dialog = false">Đóng</el-button>
        <el-button type="primary" :loading="saving" @click="save">Lưu</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="classDialog" title="Sửa lớp học / Zoom" width="560px" destroy-on-close>
      <el-form label-width="130px">
        <el-form-item label="Tên lớp">
          <el-input v-model="classForm.name" />
        </el-form-item>
        <el-form-item label="Tên ngắn">
          <el-input v-model="classForm.shortName" />
        </el-form-item>
        <el-form-item label="Thời gian">
          <el-input v-model="classForm.timeText" />
        </el-form-item>
        <el-form-item label="Zoom ID">
          <el-input v-model="classForm.zoomMeetingId" />
        </el-form-item>
        <el-form-item label="Zoom pass">
          <el-input v-model="classForm.zoomPass" />
        </el-form-item>
        <el-form-item label="Zoom URL">
          <el-input v-model="classForm.zoomUrl" />
        </el-form-item>
        <el-form-item label="Giảng sư mặc định">
          <el-select v-model="classForm.defaultTeacherId" clearable style="width: 100%">
            <el-option
              v-for="t in teachers"
              :key="t.id"
              :label="[t.rank, t.name].filter(Boolean).join(' ')"
              :value="t.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="classDialog = false">Hủy</el-button>
        <el-button type="primary" :loading="classSaving" @click="saveClass">Lưu</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.section-head h3 {
  margin: 0 0 10px;
}
.toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 14px;
}
.toolbar-right {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.hint {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 0.9rem;
}
.muted {
  color: #9ca3af;
  font-size: 0.8rem;
}
.editor-grid {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 16px;
  align-items: start;
}
@media (max-width: 900px) {
  .editor-grid {
    grid-template-columns: 1fr;
  }
}
.photo-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.poster-preview {
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  min-height: 520px;
  background-size: cover;
  background-position: center;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}
.poster-inner {
  padding: 18px 16px;
  text-align: center;
  color: #3b2a1a;
  background: linear-gradient(
    180deg,
    rgba(253, 248, 238, 0.55),
    rgba(253, 248, 238, 0.72)
  );
  min-height: 520px;
}
.p-temple {
  margin: 0;
  font-weight: 800;
  letter-spacing: 0.04em;
  font-size: 0.95rem;
  color: #8a6a1f;
}
.p-addr {
  margin: 4px 0 10px;
  font-size: 0.72rem;
}
.p-label {
  margin: 0;
  font-weight: 700;
  font-size: 0.85rem;
}
.p-title {
  margin: 6px 0;
  font-size: 1.15rem;
  font-weight: 800;
  color: #b08b4f;
  text-transform: uppercase;
}
.p-format,
.p-topic,
.p-teacher,
.p-note {
  margin: 4px 0;
  font-size: 0.78rem;
}
.p-photo-wrap {
  display: flex;
  justify-content: center;
  margin: 10px 0;
}
.p-photo {
  width: 96px;
  height: 96px;
  object-fit: cover;
  border-radius: 50%;
  border: 3px solid #c4a484;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}
.p-box {
  margin: 10px auto 0;
  max-width: 92%;
  text-align: left;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(176, 139, 79, 0.35);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 0.75rem;
}
.p-box p {
  margin: 3px 0;
}
</style>
