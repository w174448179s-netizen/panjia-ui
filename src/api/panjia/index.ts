import request from '@/utils/request';

// 所有盘家业务接口使用 /api/panjia 前缀
const panjiaRequest = {
  get<T>(url: string, params?: any) {
    return request.get<T>(`/api/panjia${url}`, params);
  },
  post<T>(url: string, data?: any) {
    return request.post<T>(`/api/panjia${url}`, data);
  },
  put<T>(url: string, data?: any) {
    return request.put<T>(`/api/panjia${url}`, data);
  },
  delete<T>(url: string, params?: any) {
    return request.delete<T>(`/api/panjia${url}`, params);
  }
};

export default panjiaRequest;
