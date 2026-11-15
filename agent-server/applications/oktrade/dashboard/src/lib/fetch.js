import axios from 'axios';
import { getHost } from './utils';
import { useAuth } from '@/context/auth';
import { useNavigate } from 'react-router-dom';

const _fetch = axios.create({
  baseURL: `${getHost()}/api`
})

_fetch.interceptors.request.use(
  (config) => {
    if (config.url === '/login') {
      config.withCredentials = true;
    }
    return config;
  },
  error => Promise.reject(error)
)

_fetch.interceptors.response.use(
  (response) => {
    if (response.data) {
      if (response.data.success) {
        return {
          message: response.data.message,
          data: response.data.data
        };
      }
    }

    return Promise.reject({
      status: error.response.status,
      message: response.data.message,
      error_code: response.data.error_code,
      url: response.config.url
    })
  },
  (error) => {
    return Promise.reject({
      status: error.response.status,
      message: error.response.data.message,
      error_code: error.response.data.error_code,
      url: error.response.config.url
    });
  }
)

const authFetch = axios.create({
  baseURL: `${getHost()}/api`
});

authFetch.defaults.withCredentials = true;

authFetch.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      authFetch.defaults.hooks.setToken(null);
      authFetch.defaults.hooks.navigate('/');
    }
    return config; 
  },
  (error) => Promise.reject(error)
);

authFetch.interceptors.response.use(
  (response) => {
    if (response.data) {
      if (response.data.success) {
        return {
          message: response.data.message,
          data: response.data.data
        };
      }
    }

    return Promise.reject({
      status: error.response.status,
      message: response.data.message,
      error_code: response.data.error_code,
      url: response.config.url
    })
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const response = await authFetch.get('/refresh-token');
        const token = response.data.data.accessToken;

        localStorage.setItem('token', token);

        // Retry the original request with the new token
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return authFetch(originalRequest);
      } catch (error) {
        authFetch.defaults.hooks.setToken(null);
        authFetch.defaults.hooks.navigate('/');
        return Promise.reject(error);
      }
    }

    return Promise.reject({
      status: error.response.status,
      message: error.response.data.message,
      error_code: error.response.data.error_code,
      url: error.response.config.url
    });
  }
);

export function useAuthFetch() {

  const { _, setToken } = useAuth();
  const navigate = useNavigate();

  authFetch.defaults.hooks = { setToken, navigate };

  return authFetch;
}

export function useFetch() {
  return _fetch;
}