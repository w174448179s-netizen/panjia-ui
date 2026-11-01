import request from '@/utils/request';

/** 钉钉 H5 微应用免登：获取 CorpId 等配置 */
export function getDingTalkSsoConfig() {
  return request({
    url: '/auth/dingtalk/config',
    headers: { isToken: false },
    method: 'get'
  });
}

/** 钉钉 H5 微应用免登：用免登授权码换取系统 token */
export function dingTalkSsoLogin(data: { code: string; clientId?: string }) {
  return request({
    url: '/auth/dingtalk/login',
    headers: { isToken: false, repeatSubmit: false },
    method: 'post',
    data
  });
}
