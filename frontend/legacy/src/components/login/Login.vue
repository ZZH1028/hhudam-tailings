<template>
  <div class="login-wrapper">
    <div class="bg-image"></div>
    <div class="bg-gradient"></div>
    <div class="ocean-background">
      <div class="wave wave1"></div>
      <div class="wave wave2"></div>
    </div>
    <div class="login-box glass-panel">
      <div class="login-header">
        <h2 class="app-title">尾矿库安全管理平台</h2>
        <p class="app-subtitle">DIGITAL TWIN WATER CONSERVANCY</p>
      </div>
      <div class="login-content">
        <div class="input-group">
          <label for="legacy-account">账号 Account</label>
          <div class="input-inner">
            <span class="input-icon">👤</span>
            <input
              type="text"
              id="legacy-account"
              autocomplete="username"
              ref="usernameInput"
              v-model="username"
              placeholder="请输入原平台账号"
              @keyup.enter="focusPassword"
              @focus="clearError"
            />
          </div>
        </div>
        <div class="input-group">
          <label for="legacy-password">密码 Password</label>
          <div class="input-inner">
            <span class="input-icon">🔒</span>
            <input
              type="password"
              id="legacy-password"
              autocomplete="current-password"
              ref="passwordInput"
              v-model="password"
              placeholder="请输入原平台密码"
              @keyup.enter="handleLogin"
              @focus="clearError"
            />
          </div>
        </div>
        <div class="msg-box">
          <span class="error-text" v-if="errorMsg">⚠️ {{ errorMsg }}</span>
        </div>
        <button class="submit-btn" @click="handleLogin">
          <span v-if="!isLoading">立即登录</span>
          <span v-else>登录中...</span>
        </button>
        <div class="footer-hint">
          <span>请使用原平台账号登录</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { fetchOriginal } from '../../originalApi.js';
import { ref } from 'vue';

const emit = defineEmits(['login-success']);

const username = ref('');
const password = ref('');
const isLoading = ref(false);
const errorMsg = ref('');

const usernameInput = ref(null);
const passwordInput = ref(null);

const clearError = () => {
  errorMsg.value = '';
};

const focusPassword = () => {
  passwordInput.value?.focus();
};

const handleLogin = async () => {
  if (isLoading.value) return;
  clearError();

  if (!username.value.trim()) {
    errorMsg.value = '请输入账号';
    usernameInput.value?.focus();
    return;
  }
  if (!password.value.trim()) {
    errorMsg.value = '请输入密码';
    passwordInput.value?.focus();
    return;
  }

  isLoading.value = true;
  try {
    const response = await fetchOriginal('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.value.trim(),
        password: password.value.trim()
      })
    });

    const result = await response.json();

    if (!result.success) {
      errorMsg.value = result.message || '登录失败';
      return;
    }

    const { user } = result.data;
    emit('login-success', {
      username: user.username,
      role: user.role
    });
  } catch (err) {
    console.error('请求错误:', err);
    errorMsg.value = '原站登录服务暂时无法连接，请稍后重试';
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.login-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #000;
  overflow: hidden;
  z-index: 9999;
}
.bg-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url('https://s1.img-e.com/20260512/6a033492f0769.jpg');
  background-size: cover;
  background-position: center;
  z-index: -3;
}
.bg-gradient {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, #02101d 0%, #041c32 100%);
  opacity: 0.4;
  z-index: -2;
}
.ocean-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
}
.wave {
  position: absolute;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.05), transparent 60%);
  animation: rotate 20s linear infinite;
  opacity: 0.6;
  left: -50%;
  top: -50%;
}
.wave2 {
  animation-direction: reverse;
  animation-duration: 30s;
  opacity: 0.3;
}
@keyframes rotate {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.login-box {
  width: 420px;
  padding: 50px 40px;
  border-radius: 16px;
  background: rgba(4, 28, 50, 0.75);
  backdrop-filter: blur(20px);
  box-shadow: 0 0 30px rgba(0, 168, 255, 0.15), inset 0 0 0 1px rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  gap: 30px;
  transform: translateY(-20px);
}
.app-title {
  color: #fff;
  text-align: center;
  font-size: 28px;
  margin: 0;
  letter-spacing: 2px;
  text-shadow: 0 0 10px rgba(0, 168, 255, 0.5);
}
.app-subtitle {
  color: #5aa1bf;
  text-align: center;
  font-size: 10px;
  letter-spacing: 3px;
  margin: 10px 0 0 0;
  opacity: 0.8;
}
.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.input-group label {
  color: #a0cfff;
  font-size: 14px;
  margin-left: 4px;
}
.input-inner {
  position: relative;
  display: flex;
  align-items: center;
}
.input-icon {
  position: absolute;
  left: 15px;
  color: #00a8ff;
  font-size: 18px;
  z-index: 10;
}
.input-inner input {
  width: 100%;
  height: 50px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(0, 168, 255, 0.3);
  border-radius: 8px;
  padding: 0 15px 0 45px;
  color: #fff;
  font-size: 16px;
  outline: none;
  transition: all 0.3s;
}
.input-inner input:focus {
  border-color: #00a8ff;
  box-shadow: 0 0 15px rgba(0, 168, 255, 0.3);
  background: rgba(0, 0, 0, 0.5);
}
.msg-box {
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.error-text {
  color: #ff6b6b;
  font-size: 13px;
  background: rgba(255, 0, 0, 0.1);
  padding: 2px 10px;
  border-radius: 4px;
}
.submit-btn {
  width: 100%;
  height: 50px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(90deg, #0072ff 0%, #00c6ff 100%);
  color: white;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  letter-spacing: 4px;
}
.submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(0, 198, 255, 0.4);
}
.footer-hint {
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}
.divider {
  margin: 0 10px;
}
</style>