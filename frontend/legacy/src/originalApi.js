import axios from 'axios';

const originalOrigin = 'https://hhudam.vip.cpolar.cn';

export const originalAxios = axios.create({ baseURL: originalOrigin });

export function originalUrl(path) {
  return new URL(path, originalOrigin).href;
}

export function fetchOriginal(path, options) {
  return fetch(originalUrl(path), { ...options, credentials: 'omit' });
}
