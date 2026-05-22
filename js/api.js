/**
 * RoleChat — API 调用封装、SSE 流式解析
 * 支持多服务商预设 + 自定义配置
 */

const API = (() => {
  // ===================== 服务商预设 =====================
  const PROVIDERS = {
    deepseek: {
      name: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com/v1/chat/completions',
      models: ['deepseek-chat', 'deepseek-reasoner'],
      defaultModel: 'deepseek-chat',
      authHeader: 'Authorization',
      authPrefix: 'Bearer '
    },
    openai: {
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1/chat/completions',
      models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
      defaultModel: 'gpt-4o-mini',
      authHeader: 'Authorization',
      authPrefix: 'Bearer '
    },
    moonshot: {
      name: 'Moonshot（月之暗面）',
      baseUrl: 'https://api.moonshot.cn/v1/chat/completions',
      models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
      defaultModel: 'moonshot-v1-8k',
      authHeader: 'Authorization',
      authPrefix: 'Bearer '
    },
    zhipu: {
      name: '智谱 GLM',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      models: ['glm-4-flash', 'glm-4', 'glm-4-plus'],
      defaultModel: 'glm-4-flash',
      authHeader: 'Authorization',
      authPrefix: 'Bearer '
    },
    qwen: {
      name: '通义千问',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      models: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
      defaultModel: 'qwen-turbo',
      authHeader: 'Authorization',
      authPrefix: 'Bearer '
    },
    custom: {
      name: '自定义',
      baseUrl: '',
      models: [],
      defaultModel: '',
      authHeader: 'Authorization',
      authPrefix: 'Bearer '
    }
  };

  const STORAGE_KEY = 'rolechat_api_config';

  // ===================== 默认配置 =====================
  const DEFAULT_CONFIG = {
    provider: 'deepseek',
    baseUrl: PROVIDERS.deepseek.baseUrl,
    apiKey: '',
    model: PROVIDERS.deepseek.defaultModel,
    authHeader: PROVIDERS.deepseek.authHeader,
    authPrefix: PROVIDERS.deepseek.authPrefix
  };

  // ===================== 配置读写 =====================
  function getConfig() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (stored && stored.apiKey) {
        // 迁移旧版兼容：补全缺失字段
        return { ...DEFAULT_CONFIG, ...stored };
      }
    } catch (e) { /* ignore */ }
    return { ...DEFAULT_CONFIG };
  }

  function saveConfig(partial) {
    const current = getConfig();
    const merged = { ...current, ...partial };

    // 如果切换了服务商，自动补全预设值
    if (partial.provider && partial.provider !== 'custom') {
      const p = PROVIDERS[partial.provider];
      if (p) {
        merged.baseUrl = p.baseUrl;
        merged.model = p.defaultModel;
        merged.authHeader = p.authHeader;
        merged.authPrefix = p.authPrefix;
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  }

  function getProviders() {
    return Object.entries(PROVIDERS).map(([key, val]) => ({
      id: key,
      name: val.name,
      baseUrl: val.baseUrl,
      models: val.models
    }));
  }

  // ===================== 连接检测 =====================
  async function testConnection(cfg) {
    const config = cfg || getConfig();
    if (!config.apiKey) return { ok: false, error: '未配置 API Key' };
    if (!config.baseUrl) return { ok: false, error: '未配置 Base URL' };

    try {
      const resp = await fetch(config.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [config.authHeader]: config.authPrefix + config.apiKey
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1,
          stream: false
        })
      });

      const text = await resp.text();
      let json;
      try { json = JSON.parse(text); } catch (e) { json = { raw: text.slice(0, 200) }; }

      return {
        ok: resp.ok,
        status: resp.status,
        data: json
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ===================== 流式聊天 =====================
  function streamChat(messages, callbacks = {}) {
    const config = getConfig();

    if (!config.apiKey) {
      callbacks.onError && callbacks.onError(new Error('未配置 API Key。请前往「我的」页面设置。'));
      return null;
    }
    if (!config.baseUrl) {
      callbacks.onError && callbacks.onError(new Error('未配置 Base URL。请前往「我的」页面设置。'));
      return null;
    }

    const controller = new AbortController();
    let fullText = '';

    (async () => {
      try {
        const resp = await fetch(config.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            [config.authHeader]: config.authPrefix + config.apiKey
          },
          body: JSON.stringify({
            model: config.model || 'deepseek-chat',
            messages: messages,
            stream: true
          }),
          signal: controller.signal
        });

        if (!resp.ok) {
          const errText = await resp.text();
          let errMsg = `HTTP ${resp.status}`;
          try {
            const errJson = JSON.parse(errText);
            errMsg = errJson.error?.message || errJson.message || errMsg;
          } catch (_) {
            errMsg += ': ' + errText.slice(0, 200);
          }
          throw new Error(errMsg);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
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
            } catch (_) { /* 跳过非 JSON 行 */ }
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

  return {
    PROVIDERS,
    getConfig,
    saveConfig,
    getProviders,
    testConnection,
    streamChat
  };
})();
