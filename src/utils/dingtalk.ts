import { dingTalkSsoLogin, getDingTalkSsoConfig } from '@/api/dingtalkSso';
import { setToken } from '@/utils/auth';

/** 钉钉 JSAPI 地址（动态加载，避免额外前端依赖） */
const JSAPI_URL = 'https://g.alicdn.com/dingding/dingtalk-jsapi/3.0.25/dingtalk.open.js';

/** 钉钉容器（移动端 / PC 客户端）UA 均包含 DingTalk */
export const isDingTalkContainer = () => navigator.userAgent.toLowerCase().includes('dingtalk');

/** 按需加载钉钉 JSAPI */
export const loadDingTalkJsApi = () =>
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

/** 申请钉钉免登授权码（容器内原地调用，不产生页面跳转） */
const requestAuthCode = async (corpId: string): Promise<string> => {
  await loadDingTalkJsApi();
  const dd = (window as any).dd;
  if (!dd?.runtime?.permission?.requestAuthCode) {
    throw new Error('钉钉容器内 JSAPI 不可用，请确认「应用首页地址」已配置且可信域名正确');
  }
  return new Promise<string>((resolve, reject) => {
    dd.runtime.permission.requestAuthCode({
      corpId,
      onSuccess: (info: { code: string }) => resolve(info.code),
      onFail: (err: any) => reject(new Error(err?.errorMessage || '获取钉钉免登授权码失败'))
    });
  });
};

/** 用免登授权码换取系统 token 并写入本地（H5 JSAPI 与小程序 authCode 通用） */
export const dingTalkLoginByCode = async (code: string): Promise<string> => {
  const res: any = await dingTalkSsoLogin({ code, clientId: import.meta.env.VITE_APP_CLIENT_ID });
  const token = res?.data?.access_token;
  if (!token) {
    throw new Error(res?.data?.msg || '钉钉免登未返回登录凭证');
  }
  setToken(token);
  return token;
};

/**
 * 钉钉容器内原地免登：JSAPI 取 code 换 token，全程停留当前页面。
 * 用于移动端首页直接落地 /m，不经过 /dingtalk-sso 中转页，避免钉钉安全容器拦截。
 */
export const dingTalkAutoLogin = async (): Promise<string> => {
  const configRes: any = await getDingTalkSsoConfig();
  const corpId = configRes?.data?.corp_id;
  if (!corpId) {
    throw new Error('后端未配置钉钉 CorpId（参数管理中的 panjia.dingtalk.corp_id）');
  }
  return dingTalkLoginByCode(await requestAuthCode(corpId));
};
