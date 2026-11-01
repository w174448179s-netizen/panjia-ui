<template>
  <div class="dingtalk-sso">
    <div class="sso-card">
      <el-icon class="sso-icon" :class="{ spin: !failed }"><Loading /></el-icon>
      <h3>{{ failed ? '钉钉免登失败' : '正在通过钉钉免登…' }}</h3>
      <p class="sso-tip">{{ tip }}</p>
      <div v-if="failed" class="sso-actions">
        <el-button type="primary" @click="start">重 试</el-button>
        <el-button @click="goLogin">账号密码登录</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="DingTalkSso">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { dingTalkSsoLogin, getDingTalkSsoConfig } from '@/api/dingtalkSso';
import { getToken, setToken } from '@/utils/auth';

/** 钉钉 JSAPI 地址（动态加载，避免额外前端依赖） */
const JSAPI_URL = 'https://g.alicdn.com/dingding/dingtalk-jsapi/3.0.25/dingtalk.open.js';

const router = useRouter();
const route = useRoute();
const failed = ref(false);
const tip = ref('正在获取钉钉身份…');

const goLogin = () => router.replace('/login');

const fail = (e: unknown) => {
  failed.value = true;
  tip.value = e instanceof Error ? e.message : String(e);
};

/** 用免登授权码换系统 token，成功后直接进首页（路由守卫会拉取用户信息与菜单） */
const signIn = async (code: string) => {
  const res: any = await dingTalkSsoLogin({ code, clientId: import.meta.env.VITE_APP_CLIENT_ID });
  const token = res?.data?.access_token;
  if (!token) {
    throw new Error(res?.data?.msg || '钉钉免登未返回登录凭证');
  }
  setToken(token);
  router.replace('/index');
};

/** 按需加载钉钉 JSAPI */
const loadJsApi = () =>
  new Promise<void>((resolve, reject) => {
    if ((window as any).dd) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = JSAPI_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('钉钉 JSAPI 加载失败，请检查网络或可信域名配置'));
    document.head.appendChild(script);
  });

const start = async () => {
  failed.value = false;
  tip.value = '正在获取钉钉身份…';
  try {
    // 已登录直接进首页
    if (getToken()) {
      router.replace('/index');
      return;
    }
    // 调试 / 回调场景：URL 直接带 code
    const queryCode = route.query.code;
    if (typeof queryCode === 'string' && queryCode) {
      await signIn(queryCode);
      return;
    }
    const configRes: any = await getDingTalkSsoConfig();
    const corpId = configRes?.data?.corp_id;
    if (!corpId) {
      throw new Error('后端未配置钉钉 CorpId（参数管理中的 panjia.dingtalk.corp_id）');
    }
    await loadJsApi();
    const dd = (window as any).dd;
    if (!dd?.runtime?.permission?.requestAuthCode) {
      throw new Error('当前不在钉钉客户端内，无法免登，请使用账号密码登录');
    }
    tip.value = '正在向钉钉申请免登授权码…';
    dd.runtime.permission.requestAuthCode({
      corpId,
      onSuccess: async (info: { code: string }) => {
        try {
          await signIn(info.code);
        } catch (e) {
          fail(e);
        }
      },
      onFail: (err: any) => fail(new Error(err?.errorMessage || '获取钉钉免登授权码失败'))
    });
  } catch (e) {
    fail(e);
  }
};

onMounted(start);
</script>

<style lang="scss" scoped>
.dingtalk-sso {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #f5f7fa;
}

.sso-card {
  width: 360px;
  padding: 40px 32px;
  text-align: center;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);

  h3 {
    margin: 18px 0 8px;
    font-size: 18px;
    color: #303133;
  }
}

.sso-icon {
  font-size: 36px;
  color: #18a058;
}

.spin {
  animation: sso-spin 1s linear infinite;
}

.sso-tip {
  min-height: 36px;
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #909399;
}

.sso-actions {
  margin-top: 16px;
}

@keyframes sso-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
