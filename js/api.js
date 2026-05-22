/**
 * RoleChat — API 调用封装、SSE 流式解析
 * 调用 DeepSeek Chat Completion API（或其他兼容 API）
 */

const API = (() => {
  // 默认使用 Vercel 代理，也可直连
  const DEFAULT_BASE_URL = '/api/chat';

  /**
   * 获取存储的 API Key 和 Base URL
   */
  function getApiKey() {
    return localStorage.getItem('rolechat_api_key') || '';
  }

  function getBaseUrl() {
    return localStorage.getItem('rolechat_base_url') || DEFAULT_BASE_URL;
  }

  /**
   * 发送非流式请求（用于检测连接）
   */
  async function testConnection(apiKey) {
    const key = apiKey || getApiKey();
    if (!key) return { ok: false, error: '未配置 API Key' };

    try {
      const resp = await fetch(getBaseUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1,
          stream: false
        })
      });
      return { ok: resp.ok, status: resp.status };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * 发送流式聊天请求
   * @param {Array} messages - 消息数组 [{role, content}]
   * @param {Object} callbacks - { onToken(text), onDone(fullText), onError(err) }
   * @returns {AbortController} 用于取消请求
   */
  function streamChat(messages, callbacks = {}) {
    const key = getApiKey();
    if (!key) {
      callbacks.onError && callbacks.onError(new Error('未配置 API Key'));
      return null;
    }

    const controller = new AbortController();
    let fullText = '';

    (async () => {
      try {
        const resp = await fetch(getBaseUrl(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: messages,
            stream: true
          }),
          signal: controller.signal
        });

        if (!resp.ok) {
          const errBody = await resp.text();
          throw new Error(`API 错误 ${resp.status}: ${errBody}`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          // 最后一个可能不完整，留到下次
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              if (delta?.content) {
                fullText += delta.content;
                callbacks.onToken && callbacks.onToken(delta.content, fullText);
              }
            } catch (e) {
              // 忽略解析失败的行
            }
          }
        }

        callbacks.onDone && callbacks.onDone(fullText);
      } catch (e) {
        if (e.name !== 'AbortError') {
          callbacks.onError && callbacks.onError(e);
        }
      }
    })();

    return controller;
  }

  /**
   * 保存 API 配置
   */
  function saveConfig({ apiKey, baseUrl } = {}) {
    if (apiKey !== undefined) localStorage.setItem('rolechat_api_key', apiKey);
    if (baseUrl !== undefined) localStorage.setItem('rolechat_base_url', baseUrl);
  }

  return { getApiKey, getBaseUrl, testConnection, streamChat, saveConfig };
})();
