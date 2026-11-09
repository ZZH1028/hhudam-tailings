import { originalAxios as axios } from '../originalApi.js';

// 指向 Python 后端的 API URL（走 8080 代理，本机与外网演示均可访问）
const API_URL = "/ai-gw/chat";

/**
 * 调用 DeepSeek 聊天接口
 * @param {Array<{role: 'system'|'user'|'assistant', content: string}>} messages
 * @param {{
 *   networkEnabled?: boolean,
 *   action?: string,
 *   placeName?: string,
 *   needCoordinates?: boolean
 * }} options
 * @returns {Promise<{
 *   role: string,
 *   content: string,
 *   network_enabled?: boolean,
 *   kb_used?: boolean,
 *   location?: { longitude?: number, latitude?: number, height?: number } | null,
 *   data?: any,
 *   coordinates?: any
 * }>}
 */
export async function callDeepSeek(messages, options = {}) {
  const {
    networkEnabled = false,
    action = 'chat',
    placeName = '',
    needCoordinates = false
  } = options;

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages 必须是非空数组');
  }

  try {
    const payload = {
      model: 'glm-4-plus',
      messages,
      stream: false,
      temperature: 0.7,

      // 保留原字段
      network_enabled: networkEnabled,

      // 新增字段，供后端地点跳转逻辑使用
      action,
      placeName,
      needCoordinates
    };

    const res = await axios.post(
      API_URL,
      payload,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    console.log('DeepSeek 请求参数:', payload);
    console.log('DeepSeek 响应数据:', res.data);

    if (!res.data || !res.data.role || typeof res.data.content !== 'string') {
      throw new Error('DeepSeek 返回结构异常: ' + JSON.stringify(res.data));
    }

    return {
      role: res.data.role,
      content: res.data.content,
      network_enabled: !!res.data.network_enabled,
      kb_used: !!res.data.kb_used,

      // 新增：把定位信息透传回前端组件
      location: res.data.location ?? null,

      // 兼容后端其他可能结构
      data: res.data.data ?? null,
      coordinates: res.data.coordinates ?? null
    };
  } catch (err) {
    console.error('调用 DeepSeek 失败:', {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message
    });
    throw err;
  }
}
