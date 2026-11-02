<template>
  <div class="dingtalk-sso">
    <div class="sso-card">
      <el-icon class="sso-icon" :class="{ spin: !failed }"><Loading /></el-icon>
      <h3>{{ failed ? '钉钉免登失败' : '正在通过钉钉免登…' }}</h3>
      <p class="sso-tip">{{ tip }}</p>
      <div v-if="failed" class="sso-actions">
        <el-button type="primary" @click="start(true)">重 试</el-button>
        <el-button v-if="appKey && !inDingTalk" @click="oauthFallback">钉钉授权登录</el-button>
        <el-button @click="goLogin">账号密码登录</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="DingTalkSso">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { dingTalkOAuthLogin, dingTalkSsoLogin, getDingTalkSsoConfig } from '@/api/dingtalkSso';
import { setToken } from '@/utils/auth';
import { isDingTalkContainer, loadDingTalkJsApi } from '@/utils/dingtalk';

/** PC 端 OAuth2 授权地址 */
const OAUTH_URL = 'https://login.dingtalk.com/oauth2/auth';

/** 标记「已发起过 PC 授权」，用于识别用户取消授权后的回调，避免无限跳转 */
const OAUTH_FLAG = 'panjia_dingtalk_oauth';

const router = useRouter();
const route = useRoute();
const failed = ref(false);
const tip = ref('正在获取钉钉身份…');
/** 后端返回的 AppKey，用于兜底跳 OAuth2 授权 */
const appKey = ref('');
/** 是否在钉钉容器内（移动端或 PC 客户端），用 JSAPI 免登，不跳转 */
const inDingTalk = ref(false);

const goLogin = () => router.replace('/login');

const fail = (e: unknown) => {
  failed.value = true;
  tip.value = e instanceof Error ? e.message : String(e);
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

/** 兜底：跳钉钉 OAuth2 授权页（仅普通浏览器使用，避免容器内跳转触发安全提示） */
const oauthFallback = () => {
  if (!appKey.value) {
    fail(new Error('后端未配置钉钉 AppKey，无法授权登录'));
    return;
  }
  redirectToDingTalkOAuth(appKey.value);
};
const redirectToDingTalkOAuth = (key: string) => {
  const redirectUri = `${window.location.origin}/dingtalk-sso`;
  const state = redirectTarget();
  sessionStorage.setItem(OAUTH_FLAG, '1');
  const url =
    `${OAUTH_URL}?redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code&client_id=${encodeURIComponent(key)}` +
    `&scope=openid&state=${encodeURIComponent(state)}&prompt=consent`;
  window.location.replace(url);
};

/** 按需加载钉钉 JSAPI 见 {@link loadDingTalkJsApi} */

const start = async (retry = false) => {
  failed.value = false;
  tip.value = '正在获取钉钉身份…';
  inDingTalk.value = isDingTalkContainer();
  try {
    if (retry) sessionStorage.removeItem(OAUTH_FLAG);
    // 不做「已有 token 直接放行」：映射可能已被换绑，必须重新换取当前钉钉账号的登录态
    // 回调场景：URL 直接带 code（PC 授权回调 or 调试）
    const queryCode = route.query.code;
    if (typeof queryCode === 'string' && queryCode) {
      // 由本页发起的 OAuth2 跳转 → 走 oauth 接口；否则按钉钉免登码处理（含端内免登拼接的 code）
      if (sessionStorage.getItem(OAUTH_FLAG)) {
        tip.value = '正在用钉钉授权码换取登录态…';
        await oauthSignIn(queryCode);
      } else {
        await signIn(queryCode);
      }
      return;
    }
    const configRes: any = await getDingTalkSsoConfig();
    const corpId = configRes?.data?.corp_id;
    appKey.value = configRes?.data?.app_key || '';
    // 钉钉容器内（移动端 / PC 客户端）统一走 JSAPI 免登，不跳转、不弹安全提示
    if (inDingTalk.value) {
      if (!corpId) {
        throw new Error('后端未配置钉钉 CorpId（参数管理中的 panjia.dingtalk.corp_id）');
      }
      await loadDingTalkJsApi();
      const dd = (window as any).dd;
      if (!dd?.runtime?.permission?.requestAuthCode) {
        throw new Error('钉钉容器内 JSAPI 不可用，请确认「应用首页地址」已配置且可信域名正确');
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
      return;
    }
    // 普通浏览器：走 OAuth2 授权/扫码
    if (!appKey.value) {
      throw new Error('后端未配置钉钉 AppKey（参数管理中的 panjia.dingtalk.client_id）');
    }
    if (sessionStorage.getItem(OAUTH_FLAG)) {
      throw new Error('钉钉授权未完成，请点击重试或使用账号密码登录');
    }
    tip.value = '正在跳转钉钉授权页…';
    redirectToDingTalkOAuth(appKey.value);
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
