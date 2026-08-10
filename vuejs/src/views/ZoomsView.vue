<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import {
  createZoomRoom,
  deleteZoomRoom,
  fetchZoomRooms,
  updateZoomRoom,
} from '@/api/zoom-rooms';
import type { ZoomRoom, ZoomRoomFormData } from '@/types/models';

const loading = ref(false);
const saving = ref(false);
const rooms = ref<ZoomRoom[]>([]);
const dialogOpen = ref(false);
const editingId = ref<string | null>(null);
const formRef = ref<FormInstance>();

const form = reactive({
  name: '',
  meetingId: '',
  pass: '',
  sortOrder: 0,
  isPublished: true,
});

const rules: FormRules = {
  name: [{ required: true, message: 'Nhập tên phòng Zoom', trigger: 'blur' }],
  meetingId: [{ required: true, message: 'Nhập Zoom ID', trigger: 'blur' }],
};

async function load() {
  loading.value = true;
  try {
    rooms.value = await fetchZoomRooms(true);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Không tải được Zoom');
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = null;
  form.name = '';
  form.meetingId = '';
  form.pass = '';
  form.sortOrder = rooms.value.length + 1;
  form.isPublished = true;
  dialogOpen.value = true;
}

function openEdit(row: ZoomRoom) {
  editingId.value = row.id;
  form.name = row.name;
  form.meetingId = row.meetingId;
  form.pass = row.pass ?? '';
  form.sortOrder = row.sortOrder;
  form.isPublished = row.isPublished;
  dialogOpen.value = true;
}

function buildPayload(): ZoomRoomFormData {
  return {
    name: form.name.trim(),
    meetingId: form.meetingId.trim(),
    pass: form.pass.trim() || undefined,
    sortOrder: form.sortOrder,
    isPublished: form.isPublished,
  };
}

async function save() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  saving.value = true;
  try {
    if (editingId.value) {
      await updateZoomRoom(editingId.value, buildPayload());
      ElMessage.success('Đã lưu');
    } else {
      await createZoomRoom(buildPayload());
      ElMessage.success('Đã thêm');
    }
    dialogOpen.value = false;
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Lưu thất bại');
  } finally {
    saving.value = false;
  }
}

async function remove(row: ZoomRoom) {
  try {
    await ElMessageBox.confirm(`Xóa Zoom “${row.name}”?`, 'Xác nhận', {
      type: 'warning',
    });
    await deleteZoomRoom(row.id);
    ElMessage.success('Đã xóa');
    await load();
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
      <h1>Phòng Zoom</h1>
      <el-button type="primary" @click="openCreate">Thêm Zoom</el-button>
    </div>

    <el-table :data="rooms" stripe>
      <el-table-column prop="name" label="Tên" min-width="220" />
      <el-table-column prop="meetingId" label="Zoom ID" width="140" />
      <el-table-column prop="pass" label="Pass" width="120" />
      <el-table-column prop="sortOrder" label="Thứ tự" width="90" />
      <el-table-column label="Công khai" width="100">
        <template #default="{ row }">
          <el-tag :type="row.isPublished ? 'success' : 'info'" size="small">
            {{ row.isPublished ? 'Có' : 'Ẩn' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">Sửa</el-button>
          <el-button link type="danger" @click="remove(row)">Xóa</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="dialogOpen"
      :title="editingId ? 'Sửa Zoom' : 'Thêm Zoom'"
      width="480px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="Tên" prop="name">
          <el-input v-model="form.name" placeholder="VD: Thiền căn bản (thứ 2 / thứ 7)" />
        </el-form-item>
        <el-form-item label="Zoom ID" prop="meetingId">
          <el-input v-model="form.meetingId" />
        </el-form-item>
        <el-form-item label="Pass">
          <el-input v-model="form.pass" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="Thứ tự">
              <el-input-number v-model="form.sortOrder" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Công khai">
              <el-switch v-model="form.isPublished" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">Hủy</el-button>
        <el-button type="primary" :loading="saving" @click="save">Lưu</el-button>
      </template>
    </el-dialog>
  </div>
</template>
