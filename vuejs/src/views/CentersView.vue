<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { fetchCenters, deleteCenter } from '@/api/centers';
import type { Center } from '@/types/models';

const router = useRouter();
const loading = ref(false);
const centers = ref<Center[]>([]);

async function load() {
  loading.value = true;
  try {
    centers.value = await fetchCenters(true);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Không tải được danh sách');
  } finally {
    loading.value = false;
  }
}

async function onDelete(row: Center) {
  try {
    await ElMessageBox.confirm(
      `Xóa "${row.templeName}"? Hành động không hoàn tác.`,
      'Xác nhận xóa',
      { type: 'warning', confirmButtonText: 'Xóa', cancelButtonText: 'Huỷ' },
    );
    await deleteCenter(row.id);
    ElMessage.success('Đã xóa');
    await load();
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(e instanceof Error ? e.message : 'Xóa thất bại');
    }
  }
}

function goNew() {
  router.push('/centers/new');
}

function goEdit(id: string) {
  router.push(`/centers/${id}`);
}

onMounted(load);
</script>

<template>
  <div>
    <div class="page-header">
      <h1>Danh sách thiền viện / thiền đường</h1>
      <el-button type="primary" @click="goNew">
        <el-icon><Plus /></el-icon>
        Thêm mới
      </el-button>
    </div>

    <el-card shadow="never">
      <el-table v-loading="loading" :data="centers" stripe>
        <el-table-column prop="sortOrder" label="#" width="60" />
        <el-table-column prop="templeName" label="Tên" min-width="180" />
        <el-table-column label="Vùng" width="110">
          <template #default="{ row }">
            {{
              ({ BAC: 'Bắc', TRUNG: 'Trung', NAM: 'Nam', NUOC_NGOAI: 'Nước ngoài' } as Record<string, string>)[
                row.region
              ] ?? row.region
            }}
          </template>
        </el-table-column>
        <el-table-column prop="province" label="Tỉnh" width="110" show-overflow-tooltip />
        <el-table-column prop="address" label="Địa chỉ" min-width="200" show-overflow-tooltip />
        <el-table-column label="Trụ trì" width="160" show-overflow-tooltip>
          <template #default="{ row }">
            {{ [row.abbotRank, row.abbotName].filter(Boolean).join(' ') || '—' }}
          </template>
        </el-table-column>
        <el-table-column prop="phone" label="Điện thoại" width="120" />
        <el-table-column label="Ảnh" width="80" align="center">
          <template #default="{ row }">
            <el-image
              v-if="row.mainImageUrl"
              :src="row.mainImageUrl"
              fit="cover"
              style="width: 48px; height: 48px; border-radius: 6px"
            />
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="Hiển thị" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isPublished ? 'success' : 'info'" size="small">
              {{ row.isPublished ? 'Công khai' : 'Ẩn' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Thao tác" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="goEdit(row.id)">Sửa</el-button>
            <el-button link type="danger" @click="onDelete(row)">Xóa</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.text-muted {
  color: #909399;
}
</style>
