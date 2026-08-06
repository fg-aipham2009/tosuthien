<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  updateAdminUser,
} from '@/api/auth';
import type { AdminUser } from '@/composables/useAuth';

const loading = ref(false);
const users = ref<AdminUser[]>([]);
const dialog = ref(false);
const editing = ref<AdminUser | null>(null);

const form = reactive({
  username: '',
  password: '',
  displayName: '',
  isActive: true,
});

async function load() {
  loading.value = true;
  try {
    users.value = await listAdminUsers();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Không tải được danh sách');
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editing.value = null;
  form.username = '';
  form.password = '';
  form.displayName = '';
  form.isActive = true;
  dialog.value = true;
}

function openEdit(row: AdminUser) {
  editing.value = row;
  form.username = row.username;
  form.password = '';
  form.displayName = row.displayName ?? '';
  form.isActive = row.isActive;
  dialog.value = true;
}

async function save() {
  try {
    if (editing.value) {
      await updateAdminUser(editing.value.id, {
        displayName: form.displayName.trim() || null,
        isActive: form.isActive,
        ...(form.password ? { password: form.password } : {}),
      });
      ElMessage.success('Đã cập nhật');
    } else {
      if (!form.username.trim() || form.password.length < 8) {
        ElMessage.warning('Username và mật khẩu (≥8) là bắt buộc');
        return;
      }
      await createAdminUser({
        username: form.username.trim(),
        password: form.password,
        displayName: form.displayName.trim() || undefined,
        isActive: form.isActive,
      });
      ElMessage.success('Đã tạo tài khoản');
    }
    dialog.value = false;
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Lưu thất bại');
  }
}

async function onDelete(row: AdminUser) {
  try {
    await ElMessageBox.confirm(`Xóa tài khoản "${row.username}"?`, 'Xác nhận', {
      type: 'warning',
    });
    await deleteAdminUser(row.id);
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
  <div>
    <div class="page-header">
      <h1>Tài khoản admin</h1>
      <el-button type="primary" @click="openCreate">Thêm tài khoản</el-button>
    </div>

    <el-card shadow="never">
      <el-table v-loading="loading" :data="users" stripe>
        <el-table-column prop="username" label="Username" min-width="140" />
        <el-table-column prop="displayName" label="Tên hiển thị" min-width="160" />
        <el-table-column label="Trạng thái" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'info'" size="small">
              {{ row.isActive ? 'Active' : 'Off' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Đăng nhập gần nhất" min-width="170">
          <template #default="{ row }">
            {{
              row.lastLoginAt
                ? new Date(row.lastLoginAt).toLocaleString('vi-VN')
                : '—'
            }}
          </template>
        </el-table-column>
        <el-table-column label="Thao tác" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">Sửa</el-button>
            <el-button link type="danger" @click="onDelete(row)">Xóa</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialog"
      :title="editing ? 'Sửa tài khoản' : 'Thêm tài khoản'"
      width="480px"
    >
      <el-form label-position="top">
        <el-form-item label="Username">
          <el-input v-model="form.username" :disabled="Boolean(editing)" />
        </el-form-item>
        <el-form-item :label="editing ? 'Mật khẩu mới (để trống nếu giữ)' : 'Mật khẩu'">
          <el-input v-model="form.password" type="password" show-password />
        </el-form-item>
        <el-form-item label="Tên hiển thị">
          <el-input v-model="form.displayName" />
        </el-form-item>
        <el-form-item label="Active">
          <el-switch v-model="form.isActive" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">Huỷ</el-button>
        <el-button type="primary" @click="save">Lưu</el-button>
      </template>
    </el-dialog>
  </div>
</template>
