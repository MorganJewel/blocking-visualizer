// settings.js — localStorage helpers for app settings

const KEY_API_KEY = 'blockviz_hf_api_key';

export function getApiKey() {
  return localStorage.getItem(KEY_API_KEY) || '';
}

export function saveApiKey(key) {
  localStorage.setItem(KEY_API_KEY, key);
}

export function clearApiKey() {
  localStorage.removeItem(KEY_API_KEY);
}
