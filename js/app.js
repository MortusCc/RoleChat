/**
 * RoleChat — 页面路由、UI 交互、状态管理
 * SPA 单页应用，基于 data-page 属性切换页面
 */

const App = (() => {
  // ===================== 状态存储 =====================
  const STORAGE_KEY = {
    CHATS: 'rolechat_chats',
    ROLES: 'rolechat_roles',
    API_KEY: 'rolechat_api_key',
    BASE_URL: 'rolechat_base_url'
  };

  let state = {
    currentPage: 'chat-list',
    activeChatId: null,
    activeRoleId: null,
    editingRoleId: null,
    searchQuery: '',
    chats: [],
    roles: []
  };

  // ===================== 本地存储 =====================
  function loadData() {
    try {
      state.chats = JSON.parse(localStorage.getItem(STORAGE_KEY.CHATS) || '[]');
      state.roles = JSON.parse(localStorage.getItem(STORAGE_KEY.ROLES) || '[]');
    } catch (e) {
      state.chats = [];
      state.roles = [];
    }
  }

  function saveChats() {
    localStorage.setItem(STORAGE_KEY.CHATS, JSON.stringify(state.chats));
  }

  function saveRoles() {
    localStorage.setItem(STORAGE_KEY.ROLES, JSON.stringify(state.roles));
  }

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ===================== 页面路由 =====================
  function navigateTo(pageName) {
    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    // 显示目标页面
    const target = document.getElementById(`page-${pageName}`);
    if (target) target.classList.remove('hidden');

    state.currentPage = pageName;

    // 更新底部导航
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === pageName);
    });

    // 刷新页面内容
    switch (pageName) {
      case 'chat-list': renderChatList(); break;
      case 'chat-room': break;
      case 'role-manage': renderRoleList(); break;
      case 'role-create': break;
      case 'discover': break;
      case 'profile': updateProfile(); break;
    }
  }

  // ===================== Toast =====================
  function showToast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 2500);
  }

  // ===================== 对话管理 =====================
  function createChat() {
    // 跳到角色创建/选择流程，或者直接用默认设定
    navigateTo('role-create');
  }

  function openChat(chatId) {
    state.activeChatId = chatId;
    const chat = state.chats.find(c => c.id === chatId);
    if (!chat) return;

    document.getElementById('chat-title').textContent = chat.title || '对话';
    navigateTo('chat-room');
    renderMessages(chat);
  }

  function newChatFromRole(roleId) {
    const role = state.roles.find(r => r.id === roleId);
    if (!role) return;

    const chat = {
      id: genId(),
      title: role.worldview.slice(0, 30) || '新对话',
      roleId: role.id,
      worldview: role.worldview,
      aiRole: { name: role.aiName, persona: role.aiPersona },
      userIdentity: role.userIdentity,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      favorited: false
    };

    state.chats.unshift(chat);
    saveChats();
    openChat(chat.id);
  }

  function deleteChat(chatId) {
    state.chats = state.chats.filter(c => c.id !== chatId);
    saveChats();
    if (state.activeChatId === chatId) {
      state.activeChatId = null;
    }
    renderChatList();
    showToast('对话已删除');
  }

  function toggleFavorite(chatId) {
    const chat = state.chats.find(c => c.id === chatId);
    if (!chat) return;
    chat.favorited = !chat.favorited;
    // 收藏的置顶
    state.chats.sort((a, b) => (b.favorited ? 1 : 0) - (a.favorited ? 1 : 0));
    saveChats();
    renderChatList();
  }

  function renderChatList() {
    const container = document.getElementById('chat-list-container');
    if (!container) return;

    const query = state.searchQuery.toLowerCase();
    let filtered = state.chats;
    if (query) {
      filtered = filtered.filter(c =>
        c.title.toLowerCase().includes(query) ||
        c.worldview.toLowerCase().includes(query)
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>${query ? '无匹配对话' : '还没有对话，点击右上角开始吧'}</p></div>`;
      return;
    }

    container.innerHTML = filtered.map(chat => {
      const lastMsg = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].content.slice(0, 50) : '尚未开始对话';
      const time = new Date(chat.updatedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
      return `
        <div class="chat-card" data-chat-id="${chat.id}">
          <div class="card-title">${escHtml(chat.title)}</div>
          <div class="card-preview">${escHtml(lastMsg)}</div>
          <div class="card-time">${time}</div>
          <div class="card-actions">
            <button class="btn-favorite" data-action="favorite" data-id="${chat.id}">
              ${chat.favorited ? '★ 已收藏' : '☆ 收藏'}
            </button>
            <button class="btn-danger" data-action="delete" data-id="${chat.id}">删除</button>
          </div>
        </div>
      `;
    }).join('');

    // 绑定事件
    container.querySelectorAll('.chat-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // 如果点击的是操作按钮，不打开对话
        if (e.target.closest('button')) return;
        openChat(card.dataset.chatId);
      });
    });
  }

  function renderMessages(chat) {
    const container = document.getElementById('message-list');
    if (!container) return;

    if (chat.messages.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>开始和 ${escHtml(chat.aiRole?.name || 'AI')} 对话吧</p>
          <p style="font-size:0.8rem;color:var(--color-text-secondary);margin-top:4px;">世界观：${escHtml(chat.worldview || '无')}</p>
        </div>`;
      return;
    }

    container.innerHTML = chat.messages.map((msg, idx) => `
      <div class="message-bubble ${msg.role}" data-msg-idx="${idx}">
        <div class="msg-text">${escHtml(msg.content)}</div>
        <div class="msg-actions">
          ${msg.role === 'ai' ? '<button data-action="regenerate">↻</button>' : ''}
          <button data-action="copy">📋</button>
        </div>
      </div>
    `).join('');

    container.scrollTop = container.scrollHeight;
  }

  function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text || !state.activeChatId) return;

    const chat = state.chats.find(c => c.id === state.activeChatId);
    if (!chat) return;

    // 添加用户消息
    chat.messages.push({ role: 'user', content: text });
    input.value = '';
    chat.updatedAt = Date.now();
    saveChats();
    renderMessages(chat);

    // 构建 system prompt
    const systemContent = [
      chat.worldview ? `世界观：${chat.worldview}` : '',
      chat.aiRole?.name ? `你扮演角色【${chat.aiRole.name}】` : '',
      chat.aiRole?.persona ? `性格与语气：${chat.aiRole.persona}` : '',
      chat.userIdentity ? `你正在与【${chat.userIdentity}】对话` : ''
    ].filter(Boolean).join('\n');

    const messages = [];
    if (systemContent) {
      messages.push({ role: 'system', content: systemContent });
    }
    // 只发送最近 10 轮上下文
    const recentMsgs = chat.messages.slice(-20);
    messages.push(...recentMsgs.map(m => ({ role: m.role, content: m.content })));

    // 添加 AI 占位气泡
    chat.messages.push({ role: 'ai', content: '' });
    const aiIdx = chat.messages.length - 1;
    renderMessages(chat);

    // 调用 API
    API.streamChat(messages, {
      onToken(token, fullText) {
        chat.messages[aiIdx].content = fullText;
        updateMessageBubble(aiIdx, fullText);
      },
      onDone(fullText) {
        chat.messages[aiIdx].content = fullText;
        chat.updatedAt = Date.now();
        saveChats();
        renderMessages(chat);
      },
      onError(err) {
        chat.messages[aiIdx].content = `[错误] ${err.message}`;
        if (err.message.includes('401')) {
          chat.messages[aiIdx].content = '[错误] API Key 无效，请在"我的"页面配置。';
        }
        saveChats();
        renderMessages(chat);
      }
    });
  }

  function updateMessageBubble(idx, text) {
    const bubble = document.querySelector(`.message-bubble[data-msg-idx="${idx}"] .msg-text`);
    if (bubble) bubble.textContent = text;
    const list = document.getElementById('message-list');
    if (list) list.scrollTop = list.scrollHeight;
  }

  function regenerateLast() {
    if (!state.activeChatId) return;
    const chat = state.chats.find(c => c.id === state.activeChatId);
    if (!chat) return;

    // 移除最后一条 AI 消息
    while (chat.messages.length > 0 && chat.messages[chat.messages.length - 1].role === 'ai') {
      chat.messages.pop();
    }
    saveChats();
    renderMessages(chat);

    // 重新发送
    const lastUser = [...chat.messages].reverse().find(m => m.role === 'user');
    if (lastUser) {
      // 只保留到最后一个用户消息之前
      const userIdx = chat.messages.lastIndexOf(lastUser);
      chat.messages = chat.messages.slice(0, userIdx + 1);
      // 重新调用
      const input = document.getElementById('message-input');
      input.value = lastUser.content;
      sendMessage();
      input.value = '';
    }
  }

  // ===================== 角色管理 =====================
  function saveRole(formData) {
    const role = {
      id: state.editingRoleId || genId(),
      worldview: formData.worldview || '',
      aiName: formData.aiName || '',
      aiPersona: formData.aiPersona || '',
      userIdentity: formData.userIdentity || '',
      createdAt: Date.now()
    };

    if (state.editingRoleId) {
      const idx = state.roles.findIndex(r => r.id === state.editingRoleId);
      if (idx >= 0) state.roles[idx] = role;
    } else {
      state.roles.unshift(role);
    }

    saveRoles();
    state.editingRoleId = null;
    showToast('角色已保存');

    // 询问是否立即开始对话
    if (!formData._noPrompt) {
      setTimeout(() => {
        if (confirm('角色已保存。是否立即开始对话？')) {
          newChatFromRole(role.id);
        } else {
          navigateTo('role-manage');
        }
      }, 200);
    } else {
      navigateTo('role-manage');
    }
  }

  function editRole(roleId) {
    const role = state.roles.find(r => r.id === roleId);
    if (!role) return;

    state.editingRoleId = roleId;
    document.getElementById('role-create-title').textContent = '编辑角色';

    // 填充表单
    document.getElementById('role-worldview').value = role.worldview;
    document.getElementById('role-ai-name').value = role.aiName;
    document.getElementById('role-ai-persona').value = role.aiPersona;
    document.getElementById('role-user-identity').value = role.userIdentity;

    navigateTo('role-create');
  }

  function deleteRole(roleId) {
    if (!confirm('确定要删除这个角色吗？')) return;
    state.roles = state.roles.filter(r => r.id !== roleId);
    saveRoles();
    renderRoleList();
    showToast('角色已删除');
  }

  function renderRoleList() {
    const container = document.getElementById('role-list-container');
    if (!container) return;

    if (state.roles.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>还没有角色卡，点击右上角创建</p></div>';
      return;
    }

    container.innerHTML = state.roles.map(role => `
      <div class="chat-card" data-role-id="${role.id}">
        <div class="card-title">${escHtml(role.aiName || '未命名角色')}</div>
        <div class="card-preview">世界观：${escHtml(role.worldview?.slice(0, 40) || '无')}</div>
        <div class="card-preview" style="margin-top:2px;">身份：${escHtml(role.userIdentity || '未设定')}</div>
        <div class="card-actions">
          <button data-action="start-chat" data-id="${role.id}">开始对话</button>
          <button data-action="edit-role" data-id="${role.id}">编辑</button>
          <button class="btn-danger" data-action="delete-role" data-id="${role.id}">删除</button>
        </div>
      </div>
    `).join('');

    // 绑定事件
    container.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const { action, id } = btn.dataset;
        switch (action) {
          case 'start-chat': newChatFromRole(id); break;
          case 'edit-role': editRole(id); break;
          case 'delete-role': deleteRole(id); break;
        }
      });
    });
  }

  // ===================== 我的 =====================
  function updateProfile() {
    document.getElementById('chat-count').textContent = state.chats.length;
    document.getElementById('role-count').textContent = state.roles.length;

    // 填充 API 配置表单
    const config = API.getConfig();
    const providerEl = document.getElementById('api-provider');
    const baseUrlEl = document.getElementById('api-base-url');
    const keyEl = document.getElementById('api-key');
    const modelPresetEl = document.getElementById('api-model-preset');
    const modelCustomEl = document.getElementById('api-model-custom');

    if (providerEl) providerEl.value = config.provider || 'deepseek';
    if (baseUrlEl) baseUrlEl.value = config.baseUrl || '';
    if (keyEl) keyEl.value = config.apiKey || '';

    // 更新模型预设
    populateModelPreset(config.provider);
    if (modelPresetEl) {
      const models = API.PROVIDERS[config.provider]?.models || [];
      if (models.includes(config.model)) {
        modelPresetEl.value = config.model;
        if (modelCustomEl) modelCustomEl.value = '';
      } else {
        modelPresetEl.value = '';
        if (modelCustomEl) modelCustomEl.value = config.model || '';
      }
    }

    updateBaseUrlHint(config.provider);
  }

  /** 根据服务商填充模型预设下拉 */
  function populateModelPreset(providerId) {
    const sel = document.getElementById('api-model-preset');
    if (!sel) return;
    const models = API.PROVIDERS[providerId]?.models || [];
    sel.innerHTML = '<option value="">-- 选择预设模型 --</option>' +
      models.map(m => `<option value="${m}">${m}</option>`).join('');
  }

  /** 更新 Base URL 提示 */
  function updateBaseUrlHint(providerId) {
    const hint = document.getElementById('hint-base-url');
    if (!hint) return;
    if (providerId && providerId !== 'custom') {
      hint.textContent = '服务商预设已自动填充';
    } else {
      hint.textContent = '请输入兼容 OpenAI 格式的 API 地址';
    }
  }

  // ===================== 搜索 =====================
  let searchDebounce = null;

  // ===================== 工具函数 =====================
  function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ===================== 事件绑定 =====================
  function bindEvents() {
    // 底部导航
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        navigateTo(item.dataset.page);
      });
    });

    // 对话列表 - 搜索
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
          state.searchQuery = e.target.value;
          renderChatList();
        }, 200);
      });
    }

    // 新建对话
    document.getElementById('btn-new-chat')?.addEventListener('click', () => {
      state.editingRoleId = null;
      document.getElementById('role-create-title').textContent = '新建角色';
      // 清空表单
      ['role-worldview', 'role-ai-name', 'role-ai-persona', 'role-user-identity']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      navigateTo('role-create');
    });

    // 对话界面 - 返回
    document.getElementById('btn-back')?.addEventListener('click', () => {
      state.activeChatId = null;
      navigateTo('chat-list');
      renderChatList();
    });

    // 发送消息
    document.getElementById('btn-send')?.addEventListener('click', sendMessage);
    document.getElementById('message-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // 消息操作菜单 - 长按/右键
    document.getElementById('message-list')?.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const bubble = e.target.closest('.message-bubble');
      if (!bubble) return;
      showMessageMenu(bubble, e.clientX, e.clientY);
    });

    // 消息操作 - 点击按钮
    document.getElementById('message-list')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const bubble = btn.closest('.message-bubble');
      const idx = parseInt(bubble?.dataset?.msgIdx);
      const chat = state.chats.find(c => c.id === state.activeChatId);
      if (!chat || isNaN(idx)) return;

      switch (btn.dataset.action) {
        case 'regenerate':
          regenerateLast();
          break;
        case 'copy':
          navigator.clipboard?.writeText(chat.messages[idx]?.content || '')
            .then(() => showToast('已复制'))
            .catch(() => showToast('复制失败'));
          break;
      }
    });

    // 对话列表 - 收藏/删除
    document.getElementById('chat-list-container')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      e.stopPropagation();
      const { action, id } = btn.dataset;
      switch (action) {
        case 'favorite': toggleFavorite(id); break;
        case 'delete':
          if (confirm('确定要删除这个对话吗？')) deleteChat(id);
          break;
      }
    });

    // 角色管理 - 新建
    document.getElementById('btn-new-role')?.addEventListener('click', () => {
      state.editingRoleId = null;
      document.getElementById('role-create-title').textContent = '新建角色';
      ['role-worldview', 'role-ai-name', 'role-ai-persona', 'role-user-identity']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      navigateTo('role-create');
    });

    // 角色创建/编辑 - 表单提交
    document.getElementById('role-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = {
        worldview: document.getElementById('role-worldview')?.value || '',
        aiName: document.getElementById('role-ai-name')?.value || '',
        aiPersona: document.getElementById('role-ai-persona')?.value || '',
        userIdentity: document.getElementById('role-user-identity')?.value || ''
      };
      if (!formData.worldview && !formData.aiName) {
        showToast('请至少填写世界观或 AI 角色名称');
        return;
      }
      saveRole(formData);
    });

    // 角色创建 - 返回
    document.getElementById('btn-role-create-back')?.addEventListener('click', () => {
      state.editingRoleId = null;
      navigateTo('role-manage');
    });

    // 角色切换
    document.getElementById('btn-role-switch')?.addEventListener('click', () => {
      navigateTo('role-manage');
    });

    // ===== API 配置事件 =====

    // 服务商切换
    document.getElementById('api-provider')?.addEventListener('change', (e) => {
      const providerId = e.target.value;
      const p = API.PROVIDERS[providerId];
      if (!p) return;

      document.getElementById('api-base-url').value = p.baseUrl;
      populateModelPreset(providerId);
      updateBaseUrlHint(providerId);

      // 自动选中第一个预设模型
      if (p.models.length > 0) {
        document.getElementById('api-model-preset').value = p.defaultModel;
        document.getElementById('api-model-custom').value = '';
      }
    });

    // 模型预设选择 → 清空自定义输入
    document.getElementById('api-model-preset')?.addEventListener('change', (e) => {
      if (e.target.value) {
        document.getElementById('api-model-custom').value = '';
      }
    });

    // 自定义模型输入 → 清空预设
    document.getElementById('api-model-custom')?.addEventListener('input', (e) => {
      if (e.target.value) {
        document.getElementById('api-model-preset').value = '';
      }
    });

    // 保存配置
    document.getElementById('btn-save-api')?.addEventListener('click', () => {
      const provider = document.getElementById('api-provider')?.value || 'deepseek';
      const baseUrl = document.getElementById('api-base-url')?.value.trim() || '';
      const apiKey = document.getElementById('api-key')?.value.trim() || '';
      const modelPreset = document.getElementById('api-model-preset')?.value || '';
      const modelCustom = document.getElementById('api-model-custom')?.value.trim() || '';
      const model = modelCustom || modelPreset || API.PROVIDERS[provider]?.defaultModel || '';

      if (!apiKey) {
        showToast('请输入 API Key');
        return;
      }
      if (!baseUrl) {
        showToast('请输入 Base URL');
        return;
      }

      API.saveConfig({ provider, baseUrl, apiKey, model });
      showToast('配置已保存');

      // 自动检测连接
      setTimeout(() => testApiConnection(), 300);
    });

    // 检测连接
    document.getElementById('btn-test-api')?.addEventListener('click', () => {
      const baseUrl = document.getElementById('api-base-url')?.value.trim() || '';
      const apiKey = document.getElementById('api-key')?.value.trim() || '';
      const modelPreset = document.getElementById('api-model-preset')?.value || '';
      const modelCustom = document.getElementById('api-model-custom')?.value.trim() || '';
      const provider = document.getElementById('api-provider')?.value || 'deepseek';
      const model = modelCustom || modelPreset || API.PROVIDERS[provider]?.defaultModel || '';

      // 先用当前表单值测，不强制要求先保存
      const testCfg = {
        baseUrl,
        apiKey,
        model,
        authHeader: API.PROVIDERS[provider]?.authHeader || 'Authorization',
        authPrefix: API.PROVIDERS[provider]?.authPrefix || 'Bearer '
      };
      testApiConnection(testCfg);
    });

    // 点击其他地方关闭弹窗
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('message-action-menu');
      if (menu && !menu.contains(e.target) && !e.target.closest('.message-bubble')) {
        menu.classList.add('hidden');
      }
    });
  }

  function showMessageMenu(bubble, x, y) {
    const menu = document.getElementById('message-action-menu');
    if (!menu) return;

    menu.classList.remove('hidden');
    menu.style.left = `${Math.min(x, window.innerWidth - 160)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - 200)}px`;
    menu.dataset.bubbleIdx = bubble.dataset.msgIdx;
  }

  async function testApiConnection(cfg) {
    const statusEl = document.getElementById('api-status');
    if (!statusEl) return;

    statusEl.textContent = '检测中...';
    statusEl.className = 'status-badge';

    const result = await API.testConnection(cfg);
    if (result.ok) {
      statusEl.textContent = '已连接';
      statusEl.className = 'status-badge online';
      const model = cfg?.model || API.getConfig().model;
      showToast(`连接成功${model ? ' — ' + model : ''}`);
    } else {
      if (result.status === 401 || result.error?.includes('401')) {
        statusEl.textContent = 'Key 无效';
      } else if (result.status === 404) {
        statusEl.textContent = '地址错误(404)';
      } else {
        statusEl.textContent = result.error || '无法连接';
      }
      statusEl.className = 'status-badge offline';
      showToast('连接失败: ' + (result.error || `HTTP ${result.status}`));
    }
  }

  // ===================== 初始化 =====================
  function init() {
    loadData();
    bindEvents();
    navigateTo('chat-list');

    // 加载时检测 API
    if (API.getConfig().apiKey) {
      setTimeout(() => testApiConnection(), 500);
    }

    console.log('RoleChat 初始化完成');
  }

  return { init, navigateTo, showToast };
})();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => App.init());
