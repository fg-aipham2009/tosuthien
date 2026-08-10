<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import {
  fetchPosts,
  deletePost,
  updatePost,
  fetchPostCategories,
  createPostCategory,
  updatePostCategory,
  deletePostCategory,
} from '@/api/posts';
import { fetchTeachers } from '@/api/teachers';
import type { Post, PostCategory, PostCategoryFormData, Teacher } from '@/types/models';

const router = useRouter();
const loading = ref(false);
const posts = ref<Post[]>([]);
const categories = ref<PostCategory[]>([]);
const teachers = ref<Teacher[]>([]);
const savingOrderId = ref<string | null>(null);

const search = ref('');
const filterCategory = ref('');
const page = ref(1);
const limit = ref(20);
const total = ref(0);

const categoryDialog = ref(false);
const categoryFormDialog = ref(false);
const categoryLoading = ref(false);
const editingCategory = ref<PostCategory | null>(null);
const categoryFormRef = ref<FormInstance>();
const categoryForm = reactive<PostCategoryFormData>({
  name: '',
  slug: '',
  description: '',
  sortOrder: 0,
});

const categoryRules: FormRules = {
  name: [{ required: true, message: 'Nhập tên danh mục', trigger: 'blur' }],
};

let searchTimer: ReturnType<typeof setTimeout> | null = null;

async function loadCategories() {
  try {
    categories.value = await fetchPostCategories();
  } catch {
    categories.value = [];
  }
}

async function loadTeachers() {
  try {
    teachers.value = await fetchTeachers(true);
  } catch {
    teachers.value = [];
  }
}

function teacherLabel(t: Teacher) {
  return [t.rank, t.name].filter(Boolean).join(' ');
}

/** Same rule as public /tin-tuc list: prefer giảng sư portrait. */
function listBannerUrl(row: Post): string | null {
  const raw = (row.teacherText || '').trim().toLowerCase();
  if (raw && teachers.value.length) {
    const exact = teachers.value.find(
      (t) => teacherLabel(t).toLowerCase() === raw,
    );
    if (exact?.photoUrl) return exact.photoUrl;
    const byName = [...teachers.value]
      .filter((t) => {
        const name = t.name.toLowerCase();
        return name.length >= 4 && (raw.includes(name) || name.includes(raw));
      })
      .sort((a, b) => b.name.length - a.name.length)[0];
    if (byName?.photoUrl) return byName.photoUrl;
  }
  return row.coverImageUrl || null;
}

async function load() {
  loading.value = true;
  try {
    const data = await fetchPosts({
      all: true,
      page: page.value,
      limit: limit.value,
      search: search.value,
      category: filterCategory.value || undefined,
    });
    posts.value = data.items ?? [];
    total.value = data.total ?? 0;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Không tải được danh sách');
  } finally {
    loading.value = false;
  }
}

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 1;
    load();
  }, 300);
}

function onFilterChange() {
  page.value = 1;
  load();
}

function onPageChange(p: number) {
  page.value = p;
  load();
}

function onLimitChange(l: number) {
  limit.value = l;
  page.value = 1;
  load();
}

function categoryNames(row: Post) {
  return (row.categories ?? []).map((c) => c.name).join(', ') || '—';
}

async function onSortOrderChange(row: Post, value: number | undefined) {
  const next = Number(value ?? 0);
  if (row.sortOrder === next) return;
  savingOrderId.value = row.id;
  try {
    await updatePost(row.id, { sortOrder: next });
    await load();
    ElMessage.success('Đã cập nhật thứ tự');
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Không lưu được thứ tự');
    await load();
  } finally {
    savingOrderId.value = null;
  }
}

async function onDelete(row: Post) {
  try {
    await ElMessageBox.confirm(
      `Xóa "${row.title}"? Hành động không hoàn tác.`,
      'Xác nhận xóa',
      { type: 'warning', confirmButtonText: 'Xóa', cancelButtonText: 'Huỷ' },
    );
    await deletePost(row.id);
    ElMessage.success('Đã xóa');
    await load();
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(e instanceof Error ? e.message : 'Xóa thất bại');
    }
  }
}

function goNew() {
  router.push('/posts/new');
}

function goEdit(id: string) {
  router.push(`/posts/${id}`);
}

function openCategoryManager() {
  categoryDialog.value = true;
  loadCategories();
}

function openCategoryForm(cat?: PostCategory) {
  editingCategory.value = cat ?? null;
  categoryForm.name = cat?.name ?? '';
  categoryForm.slug = cat?.slug ?? '';
  categoryForm.description = cat?.description ?? '';
  categoryForm.sortOrder = cat?.sortOrder ?? 0;
  categoryFormDialog.value = true;
}

async function saveCategory() {
  const valid = await categoryFormRef.value?.validate().catch(() => false);
  if (!valid) return;

  categoryLoading.value = true;
  try {
    const payload: PostCategoryFormData = {
      name: categoryForm.name.trim(),
      slug: categoryForm.slug?.trim() || undefined,
      description: categoryForm.description?.trim() || undefined,
      sortOrder: categoryForm.sortOrder ?? 0,
    };
    if (editingCategory.value) {
      await updatePostCategory(editingCategory.value.id, payload);
    } else {
      await createPostCategory(payload);
    }
    categoryFormDialog.value = false;
    ElMessage.success('Đã lưu danh mục');
    await loadCategories();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Lưu danh mục thất bại');
  } finally {
    categoryLoading.value = false;
  }
}

async function onDeleteCategory(cat: PostCategory) {
  try {
    await ElMessageBox.confirm(
      `Xóa danh mục "${cat.name}"?`,
      'Xác nhận',
      { type: 'warning', confirmButtonText: 'Xóa', cancelButtonText: 'Huỷ' },
    );
    await deletePostCategory(cat.id);
    ElMessage.success('Đã xóa danh mục');
    await loadCategories();
    if (filterCategory.value === cat.slug) {
      filterCategory.value = '';
      await load();
    }
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(e instanceof Error ? e.message : 'Xóa thất bại');
    }
  }
}

onMounted(async () => {
  await Promise.all([loadCategories(), loadTeachers()]);
  await load();
});
</script>

<template>
  <div>
    <div class="page-header">
      <h1>Tin tức</h1>
      <div class="header-actions">
        <el-button @click="openCategoryManager">Quản lý danh mục</el-button>
        <el-button type="primary" @click="goNew">
          <el-icon><Plus /></el-icon>
          Thêm tin
        </el-button>
      </div>
    </div>

    <el-card shadow="never">
      <div class="toolbar">
        <el-input
          v-model="search"
          clearable
          placeholder="Tìm theo tiêu đề..."
          style="width: 260px"
          @input="onSearchInput"
          @clear="onSearchInput"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select
          v-model="filterCategory"
          clearable
          placeholder="Danh mục"
          style="width: 200px"
          @change="onFilterChange"
        >
          <el-option
            v-for="c in categories"
            :key="c.id"
            :label="c.name"
            :value="c.slug"
          />
        </el-select>
      </div>

      <el-table v-loading="loading" :data="posts" stripe empty-text="Chưa có tin tức">
        <el-table-column label="Thứ tự" width="130" align="center">
          <template #default="{ row }">
            <el-input-number
              :model-value="row.sortOrder"
              :min="0"
              :disabled="savingOrderId === row.id"
              controls-position="right"
              size="small"
              style="width: 110px"
              @change="(v: number | undefined) => onSortOrderChange(row, v)"
            />
          </template>
        </el-table-column>
        <el-table-column label="Ảnh" width="88" align="center">
          <template #default="{ row }">
            <template v-if="listBannerUrl(row)">
              <el-image
                :src="listBannerUrl(row)!"
                fit="cover"
                style="width: 56px; height: 56px; border-radius: 8px"
                :preview-src-list="[listBannerUrl(row)!]"
              />
            </template>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="Tiêu đề" min-width="220" show-overflow-tooltip />
        <el-table-column label="Danh mục" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            {{ categoryNames(row) }}
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

      <div class="pager">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next"
          :total="total"
          :current-page="page"
          :page-size="limit"
          :page-sizes="[10, 20, 50, 100]"
          @current-change="onPageChange"
          @size-change="onLimitChange"
        />
      </div>
    </el-card>

    <el-dialog v-model="categoryDialog" title="Quản lý danh mục" width="640px">
      <div style="margin-bottom: 12px">
        <el-button type="primary" size="small" @click="openCategoryForm()">Thêm danh mục</el-button>
      </div>
      <el-table :data="categories" size="small" empty-text="Chưa có danh mục">
        <el-table-column prop="name" label="Tên" min-width="140" />
        <el-table-column prop="slug" label="Slug" min-width="120" show-overflow-tooltip />
        <el-table-column prop="sortOrder" label="Thứ tự" width="80" />
        <el-table-column label="" width="120">
          <template #default="{ row }">
            <el-button link type="primary" @click="openCategoryForm(row)">Sửa</el-button>
            <el-button link type="danger" @click="onDeleteCategory(row)">Xóa</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog
      v-model="categoryFormDialog"
      :title="editingCategory ? 'Sửa danh mục' : 'Thêm danh mục'"
      width="480px"
      append-to-body
    >
      <el-form
        ref="categoryFormRef"
        :model="categoryForm"
        :rules="categoryRules"
        label-position="top"
      >
        <el-form-item label="Tên" prop="name">
          <el-input v-model="categoryForm.name" />
        </el-form-item>
        <el-form-item label="Slug">
          <el-input v-model="categoryForm.slug" placeholder="Tự tạo nếu để trống" />
        </el-form-item>
        <el-form-item label="Mô tả">
          <el-input v-model="categoryForm.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="Thứ tự">
          <el-input-number v-model="categoryForm.sortOrder" :min="0" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="categoryFormDialog = false">Huỷ</el-button>
        <el-button type="primary" :loading="categoryLoading" @click="saveCategory">Lưu</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}

.pager {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.text-muted {
  color: #909399;
}
</style>
