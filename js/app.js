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

  // ===================== 预设角色模板 =====================
  const PRESET_ROLES = [
    {
      id: 'preset-1',
      emoji: '🧙',
      worldview: '中世纪的魔法大陆，龙与骑士并存，魔法学院培养年轻法师，黑暗势力正在悄悄蔓延。',
      aiName: '老法师梅林',
      aiPersona: '睿智、幽默、偶尔卖关子。说话带古英语腔，喜欢用谜语回答问题。',
      userIdentity: '年轻的魔法学徒',
      color: '#7C3AED'
    },
    {
      id: 'preset-2',
      emoji: '🤖',
      worldview: '2077 年，新东京。巨型企业掌控一切，霓虹灯下黑客与义体人穿梭于数据洪流。',
      aiName: 'Ghost',
      aiPersona: '顶级黑客，冷漠但可靠。说话简洁，带电子术语。厌恶企业官僚。',
      userIdentity: '刚觉醒的义体人，被企业追杀',
      color: '#06B6D4'
    },
    {
      id: 'preset-3',
      emoji: '⛩️',
      worldview: '修仙大世界，万族林立。修士以灵气淬体，渡劫飞升是为终极追求。',
      aiName: '青玄真人',
      aiPersona: '仙风道骨，说话半文半白。看似冷淡实则护短，偶尔蹦出网络用语。',
      userIdentity: '刚入门的筑基期弟子',
      color: '#10B981'
    },
    {
      id: 'preset-4',
      emoji: '🔍',
      worldview: '维多利亚时代的伦敦，蒸汽与谜案交织。你所在的私家侦探社专接警方不愿碰的案子。',
      aiName: '阿瑟·布莱克',
      aiPersona: '退役警探，逻辑推演极强。烟斗不离手，说话带英式冷幽默。',
      userIdentity: '侦探社的助手兼记录员',
      color: '#8B5CF6'
    },
    {
      id: 'preset-5',
      emoji: '🚀',
      worldview: '深空探索时代，人类殖民银河系边缘。未知信号从黑洞方向传来。',
      aiName: 'NOVA',
      aiPersona: '飞船 AI，理性和微妙的幽默感。偶尔质疑人类的情绪化决策。',
      userIdentity: '星际飞船的指挥官',
      color: '#F59E0B'
    },
    {
      id: 'preset-6',
      emoji: '📚',
      worldview: '普通的高中校园。你刚转学到一个新城市，一切陌生又新鲜。',
      aiName: '林小棠',
      aiPersona: '活泼开朗的同桌，喜欢八卦和画画。说话俏皮，偶尔毒舌但心地善良。',
      userIdentity: '刚转学的高二学生',
      color: '#EC4899'
    }
  ];

  /** 从预设模板创建角色并保存 */
  function adoptPreset(index) {
    const p = PRESET_ROLES[index];
    if (!p) return;

    // 已有的同名预设角色不重复创建
    const existing = state.roles.find(r => r._presetId === p.id);
    if (existing) {
      newChatFromRole(existing.id);
      return;
    }

    const role = {
      id: genId(),
      _presetId: p.id,
      worldview: p.worldview,
      aiName: p.aiName,
      aiPersona: p.aiPersona,
      userIdentity: p.userIdentity,
      createdAt: Date.now()
    };

    state.roles.unshift(role);
    saveRoles();
    newChatFromRole(role.id);
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
      case 'discover': renderDiscover(); break;
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
          ${msg.role === 'ai' ? `<button data-action="regenerate" title="重新生成"><svg class="icon" viewBox="0 0 48 48" fill="none"><path d="M13 35H7V41" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M41 41H35V35" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M35 13H41V7" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 7H13V13" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 7.29395C7.57778 10.8714 4 17.0178 4 23.9999C4 25.0195 4.0763 26.0213 4.2235 26.9999" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M26.9999 43.7765C26.0213 43.9237 25.0195 44 23.9999 44C17.0178 44 10.8714 40.4222 7.29395 35" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M43.7765 21C43.9237 21.9786 44 22.9804 44 24C44 30.9821 40.4222 37.1285 35 40.706" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 4.2235C21.9786 4.0763 22.9804 4 24 4C30.9821 4 37.1285 7.57778 40.706 13" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : ''}
          <button data-action="copy" title="复制"><svg class="icon" viewBox="0 0 48 48" fill="none"><path d="M13 12.4316V7.8125C13 6.2592 14.2592 5 15.8125 5H40.1875C41.7408 5 43 6.2592 43 7.8125V32.1875C43 33.7408 41.7408 35 40.1875 35H35.5163" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M32.1875 13H7.8125C6.2592 13 5 14.2592 5 15.8125V40.1875C5 41.7408 6.2592 43 7.8125 43H32.1875C33.7408 43 35 41.7408 35 40.1875V15.8125C35 14.2592 33.7408 13 32.1875 13Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg></button>
          <button data-action="like" title="点赞"><svg class="icon" viewBox="0 0 48 48" fill="none"><path d="M27.6002 18.5998V11.3998C27.6002 8.41743 25.1826 5.99977 22.2002 5.99977L15.0002 22.1998V41.9998H35.9162C37.7113 42.0201 39.2471 40.7147 39.5162 38.9398L42.0002 22.7398C42.1587 21.6955 41.8506 20.6343 41.1576 19.8373C40.4645 19.0403 39.4564 18.5878 38.4002 18.5998H27.6002Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M15 22.0001H10.194C8.08532 21.9628 6.2827 23.7095 6 25.7994V38.3994C6.2827 40.4894 8.08532 42.0367 10.194 41.9994H15V22.0001Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg></button>
          <button data-action="dislike" title="踩"><svg class="icon" viewBox="0 0 48 48" fill="none"><path d="M20.3793 29.4002V36.6002C20.3793 39.5826 22.7969 42.0002 25.7793 42.0002L32.9793 25.8002V6.00023H12.0633C10.2682 5.97994 8.73244 7.2853 8.46327 9.06023L5.97927 25.2602C5.82077 26.3045 6.12885 27.3657 6.82192 28.1627C7.51499 28.9597 8.52311 29.4122 9.57927 29.4002H20.3793Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M32.9795 6.00017H37.7855C39.8942 5.96288 41.6968 7.51019 41.9795 9.60017V22.2002C41.6968 24.2901 39.8942 26.0375 37.7855 26.0002H32.9795V6.00017Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg></button>
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

  // ===================== 发现页 =====================
  function renderDiscover() {
    const container = document.getElementById('discover-container');
    if (!container) return;

    container.innerHTML = `
      <p class="discover-subtitle">选择一个预设世界观，即刻开始角色扮演</p>
      <div class="preset-grid">
        ${PRESET_ROLES.map((p, i) => `
          <div class="preset-card" data-preset-idx="${i}" style="--card-accent: ${p.color}">
            <div class="preset-emoji">${p.emoji}</div>
            <div class="preset-name">${escHtml(p.aiName)}</div>
            <div class="preset-worldview">${escHtml(p.worldview.slice(0, 48))}...</div>
            <div class="preset-meta">你将扮演：${escHtml(p.userIdentity)}</div>
          </div>
        `).join('')}
      </div>
      <div class="discover-footer">
        <p>以上为预设模板。想要自己设定？<a href="#" id="link-custom-role">前往角色创建 →</a></p>
      </div>
    `;

    // 点击预设卡片
    container.querySelectorAll('.preset-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.presetIdx);
        adoptPreset(idx);
      });
    });

    // 跳转自定义
    document.getElementById('link-custom-role')?.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('role-create');
    });
  }

  // ===================== 新建对话面板 =====================
  function showNewChatPanel() {
    const panel = document.getElementById('new-chat-panel');
    const grid = document.getElementById('panel-preset-grid');
    if (!panel || !grid) return;

    // 渲染预设选项（紧凑卡片）
    grid.innerHTML = PRESET_ROLES.map((p, i) => `
      <div class="panel-preset-item" data-preset-idx="${i}" style="--card-accent: ${p.color}">
        <span class="panel-preset-emoji">${p.emoji}</span>
        <span class="panel-preset-name">${escHtml(p.aiName)}</span>
      </div>
    `).join('');

    // 预设点击
    grid.querySelectorAll('.panel-preset-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.presetIdx);
        closeNewChatPanel();
        adoptPreset(idx);
      });
    });

    panel.classList.remove('hidden');
  }

  function closeNewChatPanel() {
    document.getElementById('new-chat-panel')?.classList.add('hidden');
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

    // 新建对话 → 弹出选择面板
    document.getElementById('btn-new-chat')?.addEventListener('click', () => {
      showNewChatPanel();
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
        case 'like':
          showToast('已点赞');
          break;
        case 'dislike':
          showToast('已踩');
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

    // ===== 新建对话面板 =====
    document.getElementById('btn-custom-create')?.addEventListener('click', () => {
      closeNewChatPanel();
      state.editingRoleId = null;
      document.getElementById('role-create-title').textContent = '新建角色';
      ['role-worldview', 'role-ai-name', 'role-ai-persona', 'role-user-identity']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      navigateTo('role-create');
    });

    document.getElementById('btn-close-panel')?.addEventListener('click', closeNewChatPanel);

    // 点击面板遮罩关闭
    document.getElementById('new-chat-panel')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeNewChatPanel();
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
