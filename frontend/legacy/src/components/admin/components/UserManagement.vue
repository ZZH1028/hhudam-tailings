<template>
  <div class="user-management-page">
    <div class="bg-grid"></div>
    <div class="bg-glow bg-glow-1"></div>
    <div class="bg-glow bg-glow-2"></div>

    <div class="page-shell">
      <div class="page-header card-shell">
        <div class="header-left">
          <div class="header-tag">USER MANAGEMENT</div>
          <h2>用户管理</h2>
          <p>管理系统用户账号、角色及状态</p>
        </div>
        <div class="header-right">
        </div>
      </div>

      <!-- 操作栏 -->
      <div class="action-bar card-shell">
        <div class="action-left">
          <input
            class="search-input"
            v-model="searchKeyword"
            placeholder="搜索用户名或邮箱"
            @keyup.enter="fetchUsers"
          />
          <select class="filter-select" v-model="filterRole">
            <option value="">全部角色</option>
            <option value="admin">管理员</option>
            <option value="user">普通用户</option>
          </select>
          <button class="action-btn ghost" @click="fetchUsers">查询</button>
          <button class="action-btn ghost" @click="resetFilters">重置</button>
        </div>
        <div class="action-right">
          <button class="action-btn primary" @click="openCreateDialog">新增用户</button>
        </div>
      </div>

      <!-- 用户列表 -->
      <div class="user-table card-shell">
        <div class="table-header">
          <div class="th" style="width: 80px;">ID</div>
          <div class="th" style="width: 150px;">用户名</div>
          <div class="th" style="width: 200px;">邮箱</div>
          <div class="th" style="width: 100px;">角色</div>
          <div class="th" style="width: 100px;">状态</div>
          <div class="th" style="width: 180px;">创建时间</div>
          <div class="th" style="width: 120px;">操作</div>
        </div>
        <div class="table-body limited-scroll">
          <div
            class="table-row"
            v-for="user in userList"
            :key="user.id"
          >
            <div class="td" style="width: 80px;">{{ user.id }}</div>
            <div class="td" style="width: 150px;">{{ user.username }}</div>
            <div class="td" style="width: 200px;">{{ user.email || '—' }}</div>
            <div class="td" style="width: 100px;">
              <span class="role-badge" :class="user.role">{{ roleText(user.role) }}</span>
            </div>
            <div class="td" style="width: 100px;">
              <span class="status-badge" :class="{ enabled: user.enabled }">
                {{ user.enabled ? '启用' : '禁用' }}
              </span>
            </div>
            <div class="td mono" style="width: 180px;">{{ formatDate(user.created_at) }}</div>
            <div class="td actions" style="width: 120px;">
              <button class="icon-btn" @click="openEditDialog(user)" title="编辑">✏️</button>
              <button class="icon-btn" @click="toggleStatus(user)" title="切换状态">
                {{ user.enabled ? '🔒' : '🔓' }}
              </button>
              <button class="icon-btn danger" @click="deleteUser(user)" title="删除">🗑️</button>
            </div>
          </div>
          <div v-if="loading" class="empty-row">加载中...</div>
          <div v-else-if="userList.length === 0" class="empty-row">暂无用户数据</div>
        </div>
      </div>

      <!-- 分页 -->
      <div class="pagination card-shell" v-if="totalPages > 1">
        <button class="page-btn" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)">上一页</button>
        <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
        <button class="page-btn" :disabled="currentPage === totalPages" @click="goToPage(currentPage + 1)">下一页</button>
      </div>
    </div>

    <!-- 新增/编辑对话框 -->
    <div class="modal-overlay" v-if="dialogVisible" @click.self="closeDialog">
      <div class="modal-card card-shell">
        <div class="modal-header">
          <h3>{{ dialogTitle }}</h3>
          <button class="close-btn" @click="closeDialog">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>用户名 <span class="required">*</span></label>
            <input class="form-input" v-model="form.username" placeholder="请输入用户名" :disabled="isEdit" />
          </div>
          <div class="form-group" v-if="!isEdit">
            <label>密码 <span class="required">*</span></label>
            <input class="form-input" type="password" v-model="form.password" placeholder="请输入密码" />
          </div>
          <div class="form-group" v-else>
            <label>密码 <span class="hint">(留空则不修改)</span></label>
            <input class="form-input" type="password" v-model="form.password" placeholder="留空则不修改" />
          </div>
          <div class="form-group">
            <label>邮箱</label>
            <input class="form-input" v-model="form.email" placeholder="选填" />
          </div>
          <div class="form-group">
            <label>角色</label>
            <select class="form-select" v-model="form.role">
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
            </select>
          </div>
          <div class="form-group">
            <label>状态</label>
            <div class="switch-wrapper">
              <label class="switch">
                <input type="checkbox" v-model="form.enabled" />
                <span class="slider"></span>
              </label>
              <span class="switch-label">{{ form.enabled ? '启用' : '禁用' }}</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="action-btn ghost" @click="closeDialog">取消</button>
          <button class="action-btn primary" @click="submitForm" :disabled="submitting">
            {{ submitting ? '提交中...' : '确定' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Toast 提示 -->
    <div class="toast" v-if="toastMsg">
      <div class="dot" :class="{ ok: !toastError, err: toastError }"></div>
      <div class="toast-text">{{ toastMsg }}</div>
    </div>
  </div>
</template>

<script>
import { originalAxios as axios } from '../../../originalApi.js';
import { ref, reactive, computed, onMounted } from 'vue';

export default {
  name: 'UserManagement',
  setup() {
    const userList = ref([]);
    const loading = ref(false);
    const searchKeyword = ref('');
    const filterRole = ref('');
    const currentPage = ref(1);
    const pageSize = ref(10);
    const totalCount = ref(0);

    const dialogVisible = ref(false);
    const isEdit = ref(false);
    const editingId = ref(null);
    const submitting = ref(false);
    const form = reactive({
      username: '',
      password: '',
      email: '',
      role: 'user',
      enabled: true
    });

    const toastMsg = ref('');
    const toastError = ref(false);

    const totalPages = computed(() => Math.ceil(totalCount.value / pageSize.value) || 1);
    const dialogTitle = computed(() => isEdit.value ? '编辑用户' : '新增用户');

    const showToast = (msg, isErr = false) => {
      toastMsg.value = msg;
      toastError.value = isErr;
      setTimeout(() => { toastMsg.value = ''; }, 3000);
    };

    const fetchUsers = async () => {
      loading.value = true;
      try {
        const res = await axios.get('/api/admin/users', {
          params: {
            page: currentPage.value,
            size: pageSize.value,
            keyword: searchKeyword.value,
            role: filterRole.value
          }
        });
        if (res.data.success) {
          userList.value = res.data.data || [];
          totalCount.value = res.data.total || 0;
        } else {
          showToast(res.data.message || '获取用户列表失败', true);
        }
      } catch (err) {
        showToast('网络错误，请稍后重试', true);
        console.error(err);
      } finally {
        loading.value = false;
      }
    };

    const resetFilters = () => {
      searchKeyword.value = '';
      filterRole.value = '';
      currentPage.value = 1;
      fetchUsers();
    };

    const goToPage = (page) => {
      currentPage.value = page;
      fetchUsers();
    };

    const openCreateDialog = () => {
      isEdit.value = false;
      editingId.value = null;
      Object.assign(form, {
        username: '',
        password: '',
        email: '',
        role: 'user',
        enabled: true
      });
      dialogVisible.value = true;
    };

    const openEditDialog = (user) => {
      isEdit.value = true;
      editingId.value = user.id;
      Object.assign(form, {
        username: user.username,
        password: '',
        email: user.email || '',
        role: user.role,
        enabled: user.enabled
      });
      dialogVisible.value = true;
    };

    const closeDialog = () => {
      dialogVisible.value = false;
    };

    const submitForm = async () => {
      if (!form.username.trim()) {
        showToast('用户名不能为空', true);
        return;
      }
      if (!isEdit.value && !form.password) {
        showToast('密码不能为空', true);
        return;
      }

      submitting.value = true;
      try {
        const url = isEdit.value
          ? `/api/admin/users/${editingId.value}`
          : '/api/admin/users';
        const method = isEdit.value ? 'put' : 'post';
        const payload = {
          username: form.username.trim(),
          email: form.email.trim() || null,
          role: form.role,
          enabled: form.enabled
        };
        if (!isEdit.value) {
          payload.password = form.password;
        } else if (form.password) {
          payload.password = form.password;
        }

        const res = await axios({ method, url, data: payload });
        if (res.data.success) {
          showToast(isEdit.value ? '用户更新成功' : '用户创建成功');
          closeDialog();
          fetchUsers();
        } else {
          showToast(res.data.message || '操作失败', true);
        }
      } catch (err) {
        showToast('请求失败，请稍后重试', true);
        console.error(err);
      } finally {
        submitting.value = false;
      }
    };

    const toggleStatus = async (user) => {
      const newStatus = !user.enabled;
      try {
        const res = await axios.patch(`/api/admin/users/${user.id}/status`, {
          enabled: newStatus
        });
        if (res.data.success) {
          user.enabled = newStatus;
          showToast(`用户已${newStatus ? '启用' : '禁用'}`);
        } else {
          showToast(res.data.message || '状态更新失败', true);
        }
      } catch (err) {
        showToast('操作失败', true);
        console.error(err);
      }
    };

    const deleteUser = async (user) => {
      if (!confirm(`确定删除用户 "${user.username}" 吗？`)) return;
      try {
        const res = await axios.delete(`/api/admin/users/${user.id}`);
        if (res.data.success) {
          showToast('用户已删除');
          fetchUsers();
        } else {
          showToast(res.data.message || '删除失败', true);
        }
      } catch (err) {
        showToast('删除失败', true);
        console.error(err);
      }
    };

    const roleText = (role) => role === 'admin' ? '管理员' : '普通用户';

    const formatDate = (dateStr) => {
      if (!dateStr) return '—';
      const d = new Date(dateStr);
      return d.toLocaleString('zh-CN', { hour12: false });
    };

    onMounted(() => {
      fetchUsers();
    });

    return {
      userList, loading, searchKeyword, filterRole,
      currentPage, pageSize, totalCount, totalPages,
      dialogVisible, isEdit, dialogTitle, form, submitting,
      toastMsg, toastError,
      fetchUsers, resetFilters, goToPage,
      openCreateDialog, openEditDialog, closeDialog, submitForm,
      toggleStatus, deleteUser, roleText, formatDate
    };
  }
};
</script>

<style scoped>
.user-management-page {
  position: relative;
  min-height: 100%;
  padding: 18px;
  color: #d9f6ff;
  background: radial-gradient(circle at 12% 10%, rgba(34, 132, 255, 0.16), transparent 26%),
              radial-gradient(circle at 90% 8%, rgba(21, 255, 208, 0.1), transparent 22%),
              linear-gradient(180deg, #07111d 0%, #091726 52%, #081321 100%);
  overflow-x: hidden;
}
.page-shell { position: relative; z-index: 1; width: 100%; }
.bg-grid {
  position: absolute; inset: 0;
  background-image: linear-gradient(rgba(93, 196, 255, 0.05) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(93, 196, 255, 0.05) 1px, transparent 1px);
  background-size: 26px 26px; pointer-events: none;
}
.bg-glow {
  position: absolute; border-radius: 999px; filter: blur(68px);
  opacity: 0.4; pointer-events: none;
}
.bg-glow-1 { width: 240px; height: 240px; background: rgba(0, 191, 255, 0.18); top: 4%; right: 4%; }
.bg-glow-2 { width: 260px; height: 260px; background: rgba(0, 255, 174, 0.12); left: -70px; bottom: 8%; }

.card-shell {
  border-radius: 20px;
  border: 1px solid rgba(98, 204, 255, 0.14);
  background: linear-gradient(180deg, rgba(8, 24, 44, 0.92), rgba(7, 19, 36, 0.96));
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.2), inset 0 0 30px rgba(74, 176, 255, 0.04);
  backdrop-filter: blur(8px);
}

.page-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 18px; padding: 18px 20px; margin-bottom: 16px;
}
.header-left { min-width: 0; }
.header-tag {
  display: inline-block; margin-bottom: 10px; padding: 5px 10px;
  border: 1px solid rgba(86, 207, 255, 0.35); border-radius: 999px;
  color: #86e8ff; font-size: 12px; letter-spacing: 1px;
  background: rgba(7, 43, 78, 0.45);
}
.page-header h2 { margin: 0; font-size: 32px; color: #f4fdff; }
.page-header p { margin: 10px 0 0; color: rgba(211, 241, 255, 0.74); font-size: 14px; }
.header-right { display: flex; gap: 10px; }
.header-chip {
  display: flex; align-items: center; gap: 8px; min-height: 38px;
  padding: 0 14px; border-radius: 12px; border: 1px solid rgba(86, 207, 255, 0.22);
  background: rgba(6, 28, 50, 0.72); color: #c7f6ff; font-size: 13px;
}
.dot { width: 8px; height: 8px; border-radius: 50%; background: #5cd6ff; }
.dot.live { background: #00ffbf; }

.action-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; margin-bottom: 16px;
}
.action-left { display: flex; gap: 10px; align-items: center; }
.search-input {
  height: 38px; width: 240px; padding: 0 12px; border-radius: 10px;
  border: 1px solid rgba(94, 196, 255, 0.2); background: rgba(9, 25, 45, 0.9);
  color: #e6fbff; outline: none;
}
.filter-select {
  height: 38px; padding: 0 12px; border-radius: 10px;
  border: 1px solid rgba(94, 196, 255, 0.2); background: rgba(9, 25, 45, 0.9);
  color: #e6fbff;
}
.action-btn {
  height: 38px; padding: 0 16px; border-radius: 10px; font-size: 13px;
  font-weight: 600; cursor: pointer; transition: all 0.2s; border: 1px solid transparent;
}
.action-btn.primary {
  background: linear-gradient(90deg, #1a87ff, #1ce0ff); color: #fff;
}
.action-btn.ghost {
  color: #8ee9ff; background: rgba(10, 31, 53, 0.9);
  border-color: rgba(94, 196, 255, 0.2);
}
.action-btn.ghost:hover { border-color: rgba(94, 196, 255, 0.35); background: rgba(14, 37, 63, 0.95); }

.user-table { padding: 0; overflow: hidden; margin-bottom: 16px; }
.table-header {
  display: flex; padding: 14px 20px; background: rgba(8, 22, 39, 0.7);
  border-bottom: 1px solid rgba(99, 205, 255, 0.1);
  color: rgba(198, 239, 255, 0.75); font-size: 13px; font-weight: 700;
}
.table-body { max-height: 500px; overflow-y: auto; }
.table-row {
  display: flex; padding: 12px 20px; border-bottom: 1px solid rgba(99, 205, 255, 0.05);
  align-items: center; transition: background 0.15s;
}
.table-row:hover { background: rgba(14, 37, 63, 0.5); }
.th, .td { font-size: 13px; color: #e7fcff; }
.td.mono { font-family: monospace; }
.role-badge {
  display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px;
  background: rgba(0, 170, 255, 0.08); border: 1px solid rgba(93, 196, 255, 0.18);
  color: #8ce9ff;
}
.role-badge.admin { background: rgba(0, 255, 174, 0.1); color: #6eebc3; }
.status-badge {
  display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px;
  background: rgba(255, 255, 255, 0.05); color: rgba(231, 246, 255, 0.6);
}
.status-badge.enabled {
  background: rgba(0, 255, 174, 0.1); color: #6eebc3;
}
.actions { display: flex; gap: 8px; }
.icon-btn {
  background: none; border: none; font-size: 16px; cursor: pointer; opacity: 0.8;
}
.icon-btn:hover { opacity: 1; }
.icon-btn.danger:hover { color: #ff5b7d; }

.empty-row { padding: 30px; text-align: center; color: rgba(203, 238, 252, 0.58); }

.pagination {
  padding: 14px 20px; display: flex; align-items: center; justify-content: center; gap: 16px;
}
.page-btn {
  height: 34px; padding: 0 16px; border-radius: 8px; border: 1px solid rgba(94, 196, 255, 0.2);
  background: rgba(10, 31, 53, 0.9); color: #8ee9ff; cursor: pointer;
}
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.page-info { color: #e7fcff; font-size: 14px; }

/* 模态框 */
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.modal-card { width: 480px; padding: 24px; }
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 20px; color: #f4fdff;
}
.modal-header h3 { margin: 0; font-size: 20px; }
.close-btn {
  background: none; border: none; color: #8ce9ff; font-size: 28px;
  cursor: pointer; line-height: 1;
}
.form-group { margin-bottom: 18px; }
.form-group label { display: block; margin-bottom: 6px; color: #a0cfff; font-size: 13px; }
.required { color: #ff5b7d; margin-left: 4px; }
.hint { color: rgba(160, 207, 255, 0.7); font-weight: normal; margin-left: 4px; }
.form-input, .form-select {
  width: 100%; height: 42px; padding: 0 12px; border-radius: 10px;
  border: 1px solid rgba(94, 196, 255, 0.2); background: rgba(9, 25, 45, 0.9);
  color: #e6fbff; outline: none; box-sizing: border-box;
}
.form-input:focus { border-color: #1ce0ff; box-shadow: 0 0 8px rgba(28, 224, 255, 0.3); }
.switch-wrapper { display: flex; align-items: center; gap: 12px; }
.switch { position: relative; display: inline-block; width: 48px; height: 24px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider {
  position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255, 255, 255, 0.15); border-radius: 24px;
  transition: 0.3s; border: 1px solid rgba(255, 255, 255, 0.2);
}
.slider:before {
  position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px;
  background: white; border-radius: 50%; transition: 0.3s;
}
input:checked + .slider { background: #1ce0ff; }
input:checked + .slider:before { transform: translateX(24px); }
.switch-label { color: #e7fcff; font-size: 14px; }

.modal-footer { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }

.toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  background: rgba(8, 24, 44, 0.95); border: 1px solid rgba(98, 204, 255, 0.2);
  border-radius: 40px; padding: 12px 24px; display: flex; align-items: center;
  gap: 10px; z-index: 2000; backdrop-filter: blur(10px);
}
.toast-text { color: #e7fcff; font-size: 14px; }
.dot.ok { background: #00ffbf; }
.dot.err { background: #ff5b7d; }
</style>