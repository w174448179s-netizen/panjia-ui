<template>
  <div class="dingtalk-sso">
    <div class="sso-card">
      <el-icon class="sso-icon" :class="{ spin: !failed }"><Loading /></el-icon>
      <h3>{{ failed ? '钉钉免登失败' : '正在通过钉钉免登…' }}</h3>
      <p class="sso-tip">{{ tip }}</p>
      <div v-if="failed" class="sso-actions">
        <el-button type="primary" @click="start(true)">重 试</el-button>
        <el-button @click="goLogin">账号密码登录</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="DingTalkSso">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { dingTalkOAuthLogin, dingTalkSsoLogin, getDingTalkSsoConfig } from '@/api/dingtalkSso';
import { getToken, setToken } from '@/utils/auth';

/** 钉钉 JSAPI 地址（动态加载，避免额外前端依赖） */
const JSAPI_URL = 'https://g.alicdn.com/dingding/dingtalk-jsapi/3.0.25/dingtalk.open.js';

/** PC 端 OAuth2 授权地址 */
const OAUTH_URL = 'https://login.dingtalk.com/oauth2/auth';

/** 标记「已发起过 PC 授权」，用于识别用户取消授权后的回调，避免无限跳转 */
const OAUTH_FLAG = 'panjia_dingtalk_oauth';

const router = useRouter();
const route = useRoute();
const failed = ref(false);
const tip = ref('正在获取钉钉身份…');

const goLogin = () => router.replace('/login');

const fail = (e: unknown) => {
  failed.value = true;
  tip.value = e instanceof Error ? e.message : String(e);
};

/** 是否在钉钉移动端内（JSAPI 免登仅移动端可用） */
const isMobileDingTalk = () => {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('dingtalk') && /android|iphone|ipad|ipod|harmonyos|mobile/.test(ua);
};

/** 落地页：优先取 OAuth2 回调带回的 state，其次 ?redirect，默认移动端首页 */
const redirectTarget = () => {
  const state = typeof route.query.state === 'string' ? route.query.state : '';
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '';
  const raw = state || redirect || '/m';
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/m';
};

/** 保存 token 并落地（路由守卫会拉取用户信息与菜单） */
const persistAndGo = (res: any) => {
  const token = res?.data?.access_token;
  if (!token) {
    throw new Error(res?.data?.msg || '钉钉免登未返回登录凭证');
  }
  sessionStorage.removeItem(OAUTH_FLAG);
  setToken(token);
  router.replace(redirectTarget());
};

/** 移动端：JSAPI 免登授权码换 token */
const signIn = async (code: string) => {
  persistAndGo(await dingTalkSsoLogin({ code, clientId: import.meta.env.VITE_APP_CLIENT_ID }));
};

/** PC 端：OAuth2 授权码换 token */
const oauthSignIn = async (code: string) => {
  persistAndGo(await dingTalkOAuthLogin({ code, clientId: import.meta.env.VITE_APP_CLIENT_ID }));
};

/** PC 端跳转钉钉 OAuth2 授权页：钉钉客户端内已登录为一键确认，浏览器内则扫码 */
const redirectToDingTalkOAuth = (appKey: string) => {
  const redirectUri = `${window.location.origin}/dingtalk-sso`;
  const state = redirectTarget();
  sessionStorage.setItem(OAUTH_FLAG, '1');
  const url =
    `${OAUTH_URL}?redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code&client_id=${encodeURIComponent(appKey)}` +
    `&scope=openid&state=${encodeURIComponent(state)}&prompt=consent`;
  window.location.replace(url);
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

const start = async (retry = false) => {
  failed.value = false;
  tip.value = '正在获取钉钉身份…';
  try {
    if (retry) sessionStorage.removeItem(OAUTH_FLAG);
    // 已登录直接落地
    if (getToken()) {
      router.replace(redirectTarget());
      return;
    }
    // 回调场景：URL 直接带 code（PC 授权回调 or 调试）
    const queryCode = route.query.code;
    if (typeof queryCode === 'string' && queryCode) {
      if (isMobileDingTalk() && !sessionStorage.getItem(OAUTH_FLAG)) {
        await signIn(queryCode);
      } else {
        tip.value = '正在用钉钉授权码换取登录态…';
        await oauthSignIn(queryCode);
      }
      return;
    }
    const configRes: any = await getDingTalkSsoConfig();
    const corpId = configRes?.data?.corp_id;
    const appKey = configRes?.data?.app_key;
    // PC 端（含钉钉 PC 客户端）：走 OAuth2 授权，钉钉已登录时一键确认，否则扫码
    if (!isMobileDingTalk()) {
      if (!appKey) {
        throw new Error('后端未配置钉钉 AppKey（参数管理中的 panjia.dingtalk.client_id）');
      }
      if (sessionStorage.getItem(OAUTH_FLAG)) {
        throw new Error('钉钉授权未完成，请点击重试或使用账号密码登录');
      }
      tip.value = '正在跳转钉钉授权页…';
      redirectToDingTalkOAuth(appKey);
      return;
    }
    // 移动端：H5 微应用 JSAPI 免登
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
