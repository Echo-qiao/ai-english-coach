import axios from 'axios'

export const http = axios.create({
  baseURL:import.meta.env.VITE_API_BASE || '/api',
  timeout: 15000,
})

// 请求拦截器：自动带上 token，业务代码里不用每次都写
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 响应拦截器：统一错误提示 + 401 自动退出
http.interceptors.response.use(
  (response) => response.data, // 直接返回 data，调用方少解一层
  (error) => {
    const status = error.response?.status as number | undefined

    if (status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (location.pathname !== '/login') location.href = '/login'
    }

    const message =
      error.response?.data?.message ?? (status ? `请求失败（${status}）` : '网络异常，请检查后端是否启动')
    return Promise.reject(new Error(message))
  },
)

/**
 * 因为拦截器已经把 AxiosResponse 解成了 data，
 * 这里的类型断言是为了让调用方直接拿到业务类型 T。
 */
export const request = {
  get: <T>(url: string, params?: unknown) => http.get(url, { params }) as unknown as Promise<T>,
  post: <T>(url: string, body?: unknown) => http.post(url, body) as unknown as Promise<T>,
}
