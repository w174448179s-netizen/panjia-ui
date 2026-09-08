<template>
  <div class="panjia-login">
    <div class="login-shell">
      <section class="login-brand">
        <div class="brand-header">
          <div class="brand-logo">
            <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="64" height="64">
              <circle cx="100" cy="100" r="96" fill="#fff" fill-opacity="0.18"/>
              <path d="M52 112 L100 70 L148 112" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="100" y1="112" x2="100" y2="148" stroke="#fff" stroke-width="11" stroke-linecap="round"/>
              <line x1="70" y1="112" x2="70" y2="148" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
              <line x1="130" y1="112" x2="130" y2="148" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
            </svg>
          </div>
          <span class="brand-pill">PANJIA · 盘家</span>
        </div>
        <h1 class="brand-title">盘家智管</h1>
        <p class="brand-slogan">把店上的事，盘得明明白白</p>
        <p class="brand-desc">
          专为房产中介打造的薪资管理与门店经营平台，整合员工档案、佣金计算、考勤积分、工资发放全流程，
          <br />
          本地部署 · 数据不出店 · 安全可靠。
        </p>
        <div class="brand-highlights">
          <span v-for="item in highlights" :key="item" class="highlight-chip">
            <span class="chip-dot"></span>
            {{ item }}
          </span>
        </div>
        <div class="brand-metrics">
          <article v-for="item in quickStats" :key="item.label" class="metric-card">
            <strong>{{ item.value }}</strong>
            <span>{{ item.label }}</span>
          </article>
        </div>
      </section>

      <el-form ref="loginRef" :model="loginForm" :rules="loginRules" class="login-form">
        <div class="title-box">
          <div>
            <p class="eyebrow">欢迎回来</p>
            <h3 class="title">登录盘家</h3>
            <p class="subtitle">使用您的账号进入管理工作台</p>
          </div>
          <lang-select />
        </div>

        <el-form-item prop="username">
          <el-input
            v-model="loginForm.username"
            type="text"
            size="large"
            auto-complete="off"
            placeholder="请输入用户名"
          >
            <template #prefix><svg-icon icon-class="user" class="el-input__icon input-icon" /></template>
          </el-input>
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            size="large"
            auto-complete="off"
            placeholder="请输入密码"
            @keyup.enter="handleLogin"
          >
            <template #prefix><svg-icon icon-class="password" class="el-input__icon input-icon" /></template>
          </el-input>
        </el-form-item>

        <el-form-item v-if="captchaEnabled" prop="code" class="captcha-row">
          <el-input
            v-model="loginForm.code"
            size="large"
            auto-complete="off"
            placeholder="请输入验证码"
            @keyup.enter="handleLogin"
          >
            <template #prefix><svg-icon icon-class="validCode" class="el-input__icon input-icon" /></template>
          </el-input>
          <div class="login-code">
            <img :src="codeUrl" class="login-code-img" @click="getCode" />
          </div>
        </el-form-item>

        <div class="form-meta">
          <el-checkbox v-model="loginForm.rememberMe">记住密码</el-checkbox>
          <a class="link-type" href="javascript:;">忘记密码？</a>
        </div>

        <el-form-item class="submit-row">
          <el-button :loading="loading" size="large" type="primary" class="submit-button" @click.prevent="handleLogin">
            <span v-if="!loading">登 录</span>
            <span v-else>登 录 中...</span>
          </el-button>
        </el-form-item>

        <div class="form-footer">
          <span class="footer-tag">本地部署 · 数据不出店</span>
        </div>
      </el-form>
    </div>

    <div class="el-login-footer">
      <span>© {{ currentYear }} 盘家智管 · 把店上的事盘得明明白白</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { to } from 'await-to-js';
import { getCodeImg } from '@/api/login';
import { LoginData } from '@/api/types';
import { useUserStore } from '@/store/modules/user';

const currentYear = new Date().getFullYear();
const quickStats = [
  { label: '佣金自动核算', value: '精准高效' },
  { label: '门店经营看板', value: '一目了然' },
  { label: '本地安全部署', value: '数据不出店' }
];
const highlights = ['员工档案管理', '佣金自动计算', '考勤积分管理', '工资一键发放'];
const userStore = useUserStore();
const router = useRouter();

const loginForm = ref<LoginData>({
  username: 'admin',
  password: 'admin123',
  rememberMe: false,
  code: '',
  uuid: '',
  clientId: '',
  grantType: ''
} as LoginData);

const loginRules: ElFormRules = {
  username: [
    {
      required: true,
      trigger: 'blur',
      message: '请输入用户名'
    }
  ],
  password: [
    {
      required: true,
      trigger: 'blur',
      message: '请输入密码'
    }
  ],
  code: [
    {
      required: true,
      trigger: 'change',
      message: '请输入验证码'
    }
  ]
};

const codeUrl = ref('');
const loading = ref(false);
const captchaEnabled = ref(true);
const redirect = ref('/panjia/employee');
const loginRef = ref<ElFormInstance>();

watch(
  () => router.currentRoute.value,
  (newRoute: any) => {
    redirect.value = newRoute.query && newRoute.query.redirect && decodeURIComponent(newRoute.query.redirect);
  },
  { immediate: true }
);

const handleLogin = () => {
  loginRef.value?.validate(async (valid: boolean, fields: any) => {
    if (valid) {
      loading.value = true;
      if (loginForm.value.rememberMe) {
        localStorage.setItem('username', String(loginForm.value.username));
        localStorage.setItem('rememberMe', String(loginForm.value.rememberMe));
      } else {
        localStorage.removeItem('username');
        localStorage.removeItem('rememberMe');
      }
      localStorage.removeItem('password');
      const [err] = await to(userStore.login(loginForm.value));
      if (!err) {
        const redirectUrl = redirect.value || '/panjia/employee';
        await router.push(redirectUrl);
        loading.value = false;
      } else {
        loading.value = false;
        if (captchaEnabled.value) {
          await getCode();
        }
      }
    } else {
      console.log('error submit!', fields);
    }
  });
};

const getCode = async () => {
  const res = await getCodeImg();
  const { data } = res;
  captchaEnabled.value = data.captchaEnabled === undefined ? true : data.captchaEnabled;
  if (captchaEnabled.value) {
    loginForm.value.code = '';
    codeUrl.value = 'data:image/gif;base64,' + data.img;
    loginForm.value.uuid = data.uuid;
  }
};

const getLoginData = () => {
  const username = localStorage.getItem('username');
  const rememberMe = localStorage.getItem('rememberMe');
  localStorage.removeItem('password');
  loginForm.value = {
    username: username === null ? String(loginForm.value.username) : username,
    password: username === null ? String(loginForm.value.password) : '',
    rememberMe: rememberMe === 'true'
  } as LoginData;
};

onMounted(() => {
  getCode();
  getLoginData();
});
</script>

<style lang="scss" scoped>
.panjia-login {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px 88px;
  background:
    radial-gradient(circle at 12% 12%, rgba(255, 90, 0, 0.28), transparent 24%),
    radial-gradient(circle at 88% 18%, rgba(255, 138, 61, 0.22), transparent 24%),
    linear-gradient(135deg, #2d1810 0%, #4a2415 42%, #ff5a00 100%);
}

.login-shell {
  width: min(1180px, 100%);
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(360px, 440px);
  gap: 26px;
  align-items: stretch;
}

.login-brand,
.login-form {
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 30px 80px rgba(45, 24, 16, 0.32);
  backdrop-filter: blur(18px);
}

.login-brand {
  padding: 42px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: #fff8f2;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
    linear-gradient(135deg, rgba(255, 90, 0, 0.38), rgba(45, 24, 16, 0.24));
}

.brand-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.brand-logo {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 6px 16px rgba(255, 90, 0, 0.35));
}

.brand-pill {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 248, 242, 0.9);
  font-size: 12px;
  letter-spacing: 0.15em;
  font-weight: 600;
}

.brand-title {
  margin: 20px 0 8px;
  font-size: clamp(38px, 5vw, 56px);
  line-height: 1.08;
  letter-spacing: 4px;
  font-weight: 800;
}

.brand-slogan {
  margin: 0 0 18px;
  font-size: 18px;
  font-weight: 600;
  color: #ffd4b0;
  letter-spacing: 2px;
}

.brand-desc {
  margin: 0;
  max-width: 580px;
  color: rgba(255, 248, 242, 0.78);
  font-size: 15px;
  line-height: 1.9;
}

.brand-highlights {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 28px 0 34px;
}

.highlight-chip {
  padding: 9px 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #fff8f2;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;

  .chip-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: linear-gradient(135deg, #ff5a00, #ff8a3d);
    box-shadow: 0 0 8px rgba(255, 138, 61, 0.6);
  }
}

.brand-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.metric-card {
  padding: 18px 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 6px;

  strong {
    font-size: 20px;
    color: #fff;
    font-weight: 700;
  }

  span {
    color: rgba(255, 248, 242, 0.72);
    font-size: 13px;
  }
}

.login-form {
  width: 100%;
  padding: 34px 30px 26px;
  z-index: 1;
  background: var(--app-surface-bg);
}

.title-box {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 28px;

  .eyebrow {
    margin: 0 0 8px;
    color: #ff5a00;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .title {
    margin: 0;
    color: var(--app-text-title);
    font-weight: 800;
    font-size: 30px;
    letter-spacing: 2px;
  }

  .subtitle {
    margin: 8px 0 0;
    color: var(--app-text-muted);
    font-size: 14px;
    line-height: 1.7;
  }

  :deep(.lang-select--style) {
    line-height: 0;
    color: var(--app-text-muted);
    padding: 10px;
    border-radius: 14px;
    background: var(--app-elevated-soft-bg);
    border: 1px solid var(--app-surface-border);
  }
}

.login-form .el-input {
  height: 48px;
}

.login-form .input-icon {
  height: 46px;
  width: 14px;
  margin-left: 0;
}

.captcha-row {
  :deep(.el-form-item__content) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 122px;
    gap: 12px;
  }
}

.form-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: -2px 0 24px;
}

.link-type {
  color: #ff5a00;
  font-size: 14px;
  text-decoration: none;

  &:hover {
    color: #ff8a3d;
  }
}

.submit-row {
  margin-bottom: 0;
}

.submit-button {
  width: 100%;
  height: 50px;
  border-radius: 16px;
  background: linear-gradient(135deg, #ff5a00, #ff8a3d);
  border: none;
  box-shadow: 0 18px 34px rgba(255, 90, 0, 0.3);
  font-weight: 600;
  letter-spacing: 4px;

  &:hover {
    background: linear-gradient(135deg, #e04a00, #ff5a00);
  }
}

.login-form :deep(.el-input__wrapper) {
  min-height: 48px;
  background-color: var(--el-bg-color);
  border-radius: 16px;
  box-shadow: 0 0 0 1px var(--app-surface-border) inset;
}

.login-form :deep(.el-input__wrapper.is-focus) {
  box-shadow:
    0 0 0 1px rgba(255, 90, 0, 0.24) inset,
    0 0 0 4px rgba(255, 90, 0, 0.12);
}

.login-form :deep(.el-checkbox__label) {
  color: var(--app-text-muted);
}

.login-form :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background-color: #ff5a00;
  border-color: #ff5a00;
}

.login-code {
  height: 48px;
  box-sizing: border-box;
  border-radius: 16px;
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--app-surface-border);

  img {
    cursor: pointer;
    vertical-align: middle;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.form-footer {
  margin-top: 20px;
  text-align: center;
}

.footer-tag {
  display: inline-block;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(255, 90, 0, 0.08);
  color: #ff5a00;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
}

.el-login-footer {
  height: 40px;
  line-height: 40px;
  position: fixed;
  bottom: 0;
  width: 100%;
  text-align: center;
  color: rgba(255, 248, 242, 0.6);
  font-size: 12px;
  letter-spacing: 0.08em;
}

.login-code-img {
  height: 48px;
  padding-left: 0;
}

@media (max-width: 960px) {
  .panjia-login {
    padding: 24px 14px 80px;
  }

  .login-shell {
    grid-template-columns: 1fr;
  }

  .login-brand {
    padding: 28px 24px;
  }

  .brand-metrics {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .login-brand {
    display: none;
  }

  .login-form {
    padding: 26px 18px 20px;
  }

  .title-box {
    flex-direction: column;
  }

  .captcha-row :deep(.el-form-item__content) {
    grid-template-columns: 1fr;
  }
}
</style>
