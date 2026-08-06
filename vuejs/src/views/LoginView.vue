<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { login } from '@/api/auth';
import { useAuth } from '@/composables/useAuth';

const router = useRouter();
const route = useRoute();
const { setSession } = useAuth();

const form = reactive({
  username: '',
  password: '',
});
const loading = ref(false);

async function onSubmit() {
  if (!form.username.trim() || !form.password) {
    ElMessage.warning('Nhập tài khoản và mật khẩu');
    return;
  }
  loading.value = true;
  try {
    const data = await login(form.username.trim(), form.password);
    setSession(data.accessToken, data.user);
    ElMessage.success('Đăng nhập thành công');
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/centers';
    await router.replace(redirect || '/centers');
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Đăng nhập thất bại');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <el-card class="login-card" shadow="hover">
      <div class="brand">
        <h1>Tổ Sư Thiền</h1>
        <p>Đăng nhập Admin</p>
      </div>
      <el-form label-position="top" @submit.prevent="onSubmit">
        <el-form-item label="Tài khoản">
          <el-input
            v-model="form.username"
            autocomplete="username"
            placeholder="admin"
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-form-item label="Mật khẩu">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            autocomplete="current-password"
            placeholder="••••••••"
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-button type="primary" class="submit" :loading="loading" @click="onSubmit">
          Đăng nhập
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%, rgba(97, 34, 0, 0.12), transparent 60%),
    #f5f7fa;
}

.login-card {
  width: min(420px, 100%);
  border-radius: 12px;
}

.brand {
  text-align: center;
  margin-bottom: 20px;
}

.brand h1 {
  margin: 0;
  font-size: 1.4rem;
  color: #612200;
}

.brand p {
  margin: 6px 0 0;
  color: #909399;
}

.submit {
  width: 100%;
  margin-top: 8px;
}
</style>
