import request from '@/utils/request';

/**
 * 把 params 对象序列化成 URLSearchParams：
 * - 数组元素 → 重复键（e.g. sourceTypes=A&sourceTypes=B），与 Spring @RequestParam List<T> 对齐
 * - 跳过 null / undefined / 空字符串（避免后端拿到 "" 当成有效值）
 * - 原生 URLSearchParams 不会自动带 `[]`，比 axios 默认的 `?k[]=v` 更兼容 Spring
 */
const serializeParams = (params?: Record<string, unknown>): URLSearchParams | undefined => {
  if (!params) return undefined;
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === null || v === undefined || v === '') return;
    if (Array.isArray(v)) {
      v.forEach((item) => {
        if (item === null || item === undefined || item === '') return;
        sp.append(k, String(item));
      });
    } else {
      sp.append(k, String(v));
    }
  });
  const text = sp.toString();
  return text ? sp : undefined;
};

/** axios config 中的 paramsSerializer 仅在 vue-tsc 严格类型下有问题，
 *  改用「序列化完 query string 后直接挂到 URL」的方式，无须改动底层 axios 包装。 */
const withQuery = (url: string, params?: Record<string, unknown>): string => {
  const sp = serializeParams(params);
  if (!sp) return url;
  return url + (url.includes('?') ? '&' : '?') + sp.toString();
};

// 所有盘家业务接口使用 /api/panjia 前缀
const panjiaRequest = {
  get<T>(url: string, params?: any) {
    return (request as any).get<T>(`/api/panjia${withQuery(url, params)}`);
  },
  post<T>(url: string, data?: any) {
    return (request as any).post<T>(`/api/panjia${url}`, data);
  },
  put<T>(url: string, data?: any) {
    return (request as any).put<T>(`/api/panjia${url}`, data);
  },
  delete<T>(url: string, params?: any) {
    return (request as any).delete<T>(`/api/panjia${withQuery(url, params)}`);
  }
};

export default panjiaRequest;
