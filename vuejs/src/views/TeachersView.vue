<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules, UploadRequestOptions } from 'element-plus';
import {
  clearTeacherPhoto,
  createTeacher,
  deleteTeacher,
  fetchTeachers,
  updateTeacher,
  uploadTeacherPhoto,
} from '@/api/teachers';
import type { Teacher, TeacherFormData } from '@/types/models';

const loading = ref(false);
const teachers = ref<Teacher[]>([]);
const dialog = ref(false);
const saving = ref(false);
const editing = ref<Teacher | null>(null);
const formRef = ref<FormInstance>();
const form = reactive<TeacherFormData>({
  name: '',
  slug: '',
  rank: 'HT',
  bio: '',
  sortOrder: 0,
  isPublished: true,
});

const rules: FormRules = {
  name: [{ required: true, message: 'Nhập tên giảng sư', trigger: 'blur' }],
};

async function load() {
  loading.value = true;
  try {
    teachers.value = await fetchTeachers(true);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Không tải được danh sách');
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editing.value = null;
  Object.assign(form, {
    name: '',
    slug: '',
    rank: 'HT',
    bio: '',
    sortOrder: teachers.value.length + 1,
    isPublished: true,
  });
  dialog.value = true;
}

function openEdit(row: Teacher) {
  editing.value = row;
  Object.assign(form, {
    name: row.name,
    slug: row.slug,
    rank: row.rank || '',
    bio: row.bio || '',
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
    if (editing.value) {
      await updateTeacher(editing.value.id, { ...form });
      ElMessage.success('Đã cập nhật giảng sư');
    } else {
      await createTeacher({ ...form });
      ElMessage.success('Đã thêm giảng sư');
    }
    dialog.value = false;
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Lưu thất bại');
  } finally {
    saving.value = false;
  }
}

async function onDelete(row: Teacher) {
  try {
    await ElMessageBox.confirm(`Xóa giảng sư「${row.rank || ''} ${row.name}」?`, 'Xác nhận', {
      type: 'warning',
    });
    await deleteTeacher(row.id);
    ElMessage.success('Đã xóa');
    await load();
  } catch {
    /* cancel */
  }
}

async function onUploadPhoto(row: Teacher, opts: UploadRequestOptions) {
  try {
    const updated = await uploadTeacherPhoto(row.id, opts.file as File);
    const i = teachers.value.findIndex((t) => t.id === row.id);
    if (i >= 0) teachers.value[i] = updated;
    ElMessage.success('Đã cập nhật ảnh giảng sư');
    opts.onSuccess?.(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upload lỗi';
    ElMessage.error(msg);
    opts.onError?.(e as never);
  }
}

async function onClearPhoto(row: Teacher) {
  try {
    const updated = await clearTeacherPhoto(row.id);
    const i = teachers.value.findIndex((t) => t.id === row.id);
    if (i >= 0) teachers.value[i] = updated;
    ElMessage.success('Đã xóa ảnh');
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Xóa ảnh lỗi');
  }
}

function displayName(row: Teacher) {
  return [row.rank, row.name].filter(Boolean).join(' ');
}

onMounted(load);
</script>

<template>
  <div>
    <div class="toolbar">
      <div>
        <h3 style="margin: 0">Danh sách giảng sư</h3>
        <p class="hint">Ảnh giảng sư dùng cho thông báo khóa học / poster.</p>
      </div>
      <el-button type="primary" @click="openCreate">Thêm giảng sư</el-button>
    </div>

    <el-table v-loading="loading" :data="teachers" stripe border>
      <el-table-column label="Ảnh" width="96">
        <template #default="{ row }">
          <el-avatar v-if="row.photoUrl" :src="row.photoUrl" :size="56" shape="circle" />
          <el-avatar v-else :size="56">{{ row.name?.slice(0, 1) }}</el-avatar>
        </template>
      </el-table-column>
      <el-table-column label="Giảng sư" min-width="200">
        <template #default="{ row }">
          <strong>{{ displayName(row) }}</strong>
          <div class="muted">{{ row.slug }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="rank" label="Phẩm" width="80" />
      <el-table-column prop="sortOrder" label="Thứ tự" width="90" />
      <el-table-column label="Hiển thị" width="100">
        <template #default="{ row }">
          <el-tag :type="row.isPublished ? 'success' : 'info'" size="small">
            {{ row.isPublished ? 'Công khai' : 'Ẩn' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="Thao tác" width="320" fixed="right">
        <template #default="{ row }">
          <el-upload
            :show-file-list="false"
            accept="image/*"
            :http-request="(o: UploadRequestOptions) => onUploadPhoto(row, o)"
          >
            <el-button size="small">{{ row.photoUrl ? 'Đổi ảnh' : 'Upload ảnh' }}</el-button>
          </el-upload>
          <el-button v-if="row.photoUrl" size="small" @click="onClearPhoto(row)">Xóa ảnh</el-button>
          <el-button size="small" @click="openEdit(row)">Sửa</el-button>
          <el-button size="small" type="danger" @click="onDelete(row)">Xóa</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="dialog"
      :title="editing ? 'Sửa giảng sư' : 'Thêm giảng sư'"
      width="520px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="Phẩm vị" prop="rank">
          <el-select v-model="form.rank" clearable placeholder="HT / TT / …" style="width: 100%">
            <el-option label="HT" value="HT" />
            <el-option label="TT" value="TT" />
            <el-option label="ĐĐ" value="ĐĐ" />
            <el-option label="NS" value="NS" />
            <el-option label="SC" value="SC" />
          </el-select>
        </el-form-item>
        <el-form-item label="Tên" prop="name">
          <el-input v-model="form.name" placeholder="Thích Minh Hiền" />
        </el-form-item>
        <el-form-item label="Slug">
          <el-input v-model="form.slug" placeholder="Tự tạo nếu để trống" />
        </el-form-item>
        <el-form-item label="Tiểu sử">
          <el-input v-model="form.bio" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="Thứ tự">
          <el-input-number v-model="form.sortOrder" :min="0" />
        </el-form-item>
        <el-form-item label="Công khai">
          <el-switch v-model="form.isPublished" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">Hủy</el-button>
        <el-button type="primary" :loading="saving" @click="save">Lưu</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
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
:deep(.el-table .el-button + .el-button) {
  margin-left: 0;
}
:deep(.el-table .el-upload),
:deep(.el-table .el-button) {
  margin: 2px;
}
</style>
