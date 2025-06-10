/**
 * UI管理器 - 处理界面交互和状态管理
 * 包括聊天界面、生成器界面、设置界面的所有交互逻辑
 */
class UIManager {
    constructor() {
        this.currentTab = 'home';
        this.isGenerating = false;
        this.isChatting = false;
        this.generatedIdeas = [];
        
        // 界面元素引用
        this.elements = {};
        
        // 初始化界面
        this.init();
    }
    
    /**
     * 初始化界面
     */
    init() {
        this.bindElements();
        this.bindEvents();
        this.loadSettings();
        this.updateAssistantOptions();
        
        // 设置默认状态
        this.switchTab('home');
        
        console.log('🎮 Indienstein UI Manager 初始化完成喵～');
    }
    
    /**
     * 启动UI管理器
     */
    async start() {
        // UI已经在init中初始化完成，这里可以做一些启动后的操作
        console.info('🎮 UI Manager 启动完成喵～');
        
        // 发送UI就绪事件
        if (window.app?.eventBus) {
            window.app.eventBus.emit('ui:ready');
        }
        
        // 可以在这里添加其他启动逻辑，比如：
        // - 检查URL参数并切换到对应标签页
        // - 显示欢迎消息
        // - 加载上次的界面状态等
        
        return Promise.resolve();
    }
    
    /**
     * 绑定界面元素
     */
    bindElements() {
        // 导航相关
        this.elements.navTabs = document.querySelectorAll('.nav-tab');
        this.elements.tabContents = document.querySelectorAll('.tab-content');
        
        // 聊天相关
        this.elements.chatMessages = document.getElementById('chat-messages');
        this.elements.chatInput = document.getElementById('chat-input');
        this.elements.sendButton = document.getElementById('send-button');
        this.elements.assistantSelect = document.getElementById('assistant-select');
        this.elements.streamMode = document.getElementById('stream-mode');
        this.elements.charCount = document.getElementById('char-count');
        
        // 生成器相关
        this.elements.dimensionItems = document.querySelectorAll('.dimension-item input[type="checkbox"]');
        this.elements.generationCount = document.getElementById('generation-count');
        this.elements.countDisplay = document.getElementById('count-display');
        this.elements.generateButton = document.getElementById('generate-button');
        this.elements.generationResults = document.getElementById('generation-results');
        this.elements.resultsList = document.getElementById('results-list');
        
        // 设置相关
        this.elements.aiProvider = document.getElementById('ai-provider');
        this.elements.apiKey = document.getElementById('api-key');
        this.elements.apiUrl = document.getElementById('api-url');
        this.elements.themeSelect = document.getElementById('theme-select');
        this.elements.animations = document.getElementById('animations');
    }
    
    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 导航切换
        this.elements.navTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });
        
        // 聊天相关事件
        if (this.elements.sendButton) {
            this.elements.sendButton.addEventListener('click', () => this.sendChatMessage());
        }
        
        if (this.elements.chatInput) {
            this.elements.chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendChatMessage();
                }
            });
            
            this.elements.chatInput.addEventListener('input', () => this.updateCharCount());
        }
        
        if (this.elements.assistantSelect) {
            this.elements.assistantSelect.addEventListener('change', () => {
                const assistantId = this.elements.assistantSelect.value;
                window.aiService.setAssistant(assistantId);
                this.addSystemMessage(`已切换到 ${window.aiService.getCurrentAssistant().name} 喵～`);
            });
        }
        
        // 生成器相关事件
        if (this.elements.generationCount) {
            this.elements.generationCount.addEventListener('input', () => this.updateCountDisplay());
        }
        
        if (this.elements.generateButton) {
            this.elements.generateButton.addEventListener('click', () => this.generateIdeas());
        }
        
        // 设置相关事件
        if (this.elements.aiProvider) {
            this.elements.aiProvider.addEventListener('change', () => this.updateProviderSettings());
        }
    }
    
    /**
     * 切换选项卡
     */
    switchTab(tabName) {
        // 更新导航状态
        this.elements.navTabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.getAttribute('data-tab') === tabName) {
                tab.classList.add('active');
            }
        });
        
        // 更新内容显示
        this.elements.tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === tabName) {
                content.classList.add('active');
            }
        });
        
        this.currentTab = tabName;
        
        // 特殊处理
        if (tabName === 'chat') {
            this.scrollChatToBottom();
        }
    }
    
    /**
     * 发送聊天消息
     */
    async sendChatMessage() {
        const message = this.elements.chatInput.value.trim();
        if (!message || this.isChatting) return;
        
        // 添加用户消息到界面
        this.addUserMessage(message);
        this.elements.chatInput.value = '';
        this.updateCharCount();
        
        // 设置发送状态
        this.setChatLoading(true);
        
        try {
            const isStream = this.elements.streamMode?.checked || false;
            
            if (isStream) {
                // 流式对话
                const assistantMessageElement = this.addAssistantMessage('', true);
                
                await window.aiService.sendStreamMessage(
                    message,
                    (chunk, fullMessage) => {
                        // 更新消息内容
                        assistantMessageElement.querySelector('p').textContent = fullMessage;
                        this.scrollChatToBottom();
                    },
                    (finalMessage) => {
                        // 完成回调
                        assistantMessageElement.querySelector('p').textContent = finalMessage;
                        this.removeTypingIndicator(assistantMessageElement);
                        this.scrollChatToBottom();
                    }
                );
            } else {
                // 非流式对话
                const result = await window.aiService.sendMessage(message);
                this.addAssistantMessage(result.message);
            }
        } catch (error) {
            this.addAssistantMessage(`发生错误: ${error.message}喵～`);
        } finally {
            this.setChatLoading(false);
        }
    }
    
    /**
     * 添加用户消息
     */
    addUserMessage(message) {
        const messageElement = this.createMessageElement('user', message, '👤');
        this.elements.chatMessages.appendChild(messageElement);
        this.scrollChatToBottom();
    }
    
    /**
     * 添加AI助手消息
     */
    addAssistantMessage(message, isTyping = false) {
        const assistant = window.aiService.getCurrentAssistant();
        const messageElement = this.createMessageElement('assistant', message, assistant.avatar);
        
        if (isTyping) {
            this.addTypingIndicator(messageElement);
        }
        
        this.elements.chatMessages.appendChild(messageElement);
        this.scrollChatToBottom();
        
        return messageElement;
    }
    
    /**
     * 添加系统消息
     */
    addSystemMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message system';
        messageElement.innerHTML = `
            <div class="message-content" style="text-align: center; color: #718096; font-style: italic;">
                <p>${message}</p>
            </div>
        `;
        this.elements.chatMessages.appendChild(messageElement);
        this.scrollChatToBottom();
    }
    
    /**
     * 创建消息元素
     */
    createMessageElement(role, content, avatar) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${role}`;
        messageElement.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <p>${content}</p>
            </div>
        `;
        return messageElement;
    }
    
    /**
     * 添加输入指示器
     */
    addTypingIndicator(messageElement) {
        const contentElement = messageElement.querySelector('.message-content p');
        contentElement.innerHTML = `
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
    }
    
    /**
     * 移除输入指示器
     */
    removeTypingIndicator(messageElement) {
        // 输入指示器会被内容替换，无需特殊处理
    }
    
    /**
     * 设置聊天加载状态
     */
    setChatLoading(isLoading) {
        this.isChatting = isLoading;
        
        if (this.elements.sendButton) {
            this.elements.sendButton.disabled = isLoading;
            const sendText = this.elements.sendButton.querySelector('.send-text');
            const loadingText = this.elements.sendButton.querySelector('.loading');
            
            if (sendText && loadingText) {
                sendText.style.display = isLoading ? 'none' : 'inline';
                loadingText.style.display = isLoading ? 'inline' : 'none';
            }
        }
    }
    
    /**
     * 滚动聊天到底部
     */
    scrollChatToBottom() {
        if (this.elements.chatMessages) {
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        }
    }
    
    /**
     * 更新字符计数
     */
    updateCharCount() {
        if (this.elements.chatInput && this.elements.charCount) {
            const count = this.elements.chatInput.value.length;
            this.elements.charCount.textContent = count;
        }
    }
    
    /**
     * 更新助手选项
     */
    updateAssistantOptions() {
        if (!this.elements.assistantSelect) return;
        
        // 检查aiService是否可用
        if (!window.aiService || !window.aiService.getAssistants) {
            return;
        }
        
        const assistants = window.aiService.getAssistants();
        this.elements.assistantSelect.innerHTML = '';
        
        for (const assistant of assistants) {
            const option = document.createElement('option');
            option.value = assistant.id;
            option.textContent = assistant.name;
            this.elements.assistantSelect.appendChild(option);
        }
        
        // 设置当前选中的助手
        if (window.aiService.getCurrentAssistant) {
            const currentAssistant = window.aiService.getCurrentAssistant();
            if (currentAssistant) {
                this.elements.assistantSelect.value = currentAssistant.id || 'eggcat';
            }
        }
    }
    
    /**
     * 生成创意
     */
    async generateIdeas() {
        if (this.isGenerating) return;
        
        // 获取选中的维度
        const selectedDimensions = [];
        this.elements.dimensionItems.forEach(item => {
            if (item.checked) {
                selectedDimensions.push(item.value);
            }
        });
        
        if (selectedDimensions.length === 0) {
            alert('请至少选择一个创意维度喵～');
            return;
        }
        
        const count = parseInt(this.elements.generationCount.value) || 3;
        
        // 设置生成状态
        this.setGeneratingStatus(true);
        this.elements.generationResults.style.display = 'block';
        this.elements.resultsList.innerHTML = '<div style="text-align: center; padding: 40px; color: #718096;">正在生成创意中，请稍候喵～</div>';
        
        try {
            // 生成词汇组合
            const ideas = [];
            for (let i = 0; i < count; i++) {
                const wordResult = window.wordGenerator.generateWords(selectedDimensions, 1);
                if (wordResult && wordResult.length > 0) {
                    ideas.push({
                        index: i + 1,
                        dimensions: selectedDimensions,
                        words: wordResult[0],
                        timestamp: new Date()
                    });
                }
            }
            
            // 为每个创意生成AI描述
            const results = [];
            for (let i = 0; i < ideas.length; i++) {
                const idea = ideas[i];
                
                // 更新进度
                this.elements.resultsList.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #718096;">
                        正在生成第 ${i + 1}/${count} 个创意喵～
                        <div style="margin-top: 10px; font-size: 0.9rem;">请耐心等待AI思考...</div>
                    </div>
                `;
                
                // 调用AI生成创意
                try {
                    // 构建创意生成的提示词
                    const prompt = this.buildGameIdeaPrompt(idea.dimensions, idea.words.byDimension);
                    const response = await window.aiService.sendMessage(prompt);
                    
                    results.push({
                        ...idea,
                        aiContent: response.content || response.message || '生成失败',
                        success: true
                    });
                } catch (error) {
                    console.error('AI generation failed:', error);
                    results.push({
                        ...idea,
                        aiContent: '生成失败：' + error.message,
                        success: false
                    });
                }
            }
            
            // 显示结果
            this.displayGenerationResults(results);
            this.generatedIdeas.push(...results);
            
        } catch (error) {
            this.elements.resultsList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #e53e3e;">
                    生成失败: ${error.message}喵～
                    <div style="margin-top: 10px; font-size: 0.9rem;">请检查网络连接和AI配置</div>
                </div>
            `;
        } finally {
            this.setGeneratingStatus(false);
        }
    }
    
    /**
     * 显示生成结果
     */
    displayGenerationResults(results) {
        this.elements.resultsList.innerHTML = '';
        
        results.forEach((result, index) => {
            const resultElement = document.createElement('div');
            resultElement.className = 'result-item';
            
            // 构建词汇标签
            const wordsHtml = Object.entries(result.words.byDimension)
                .map(([dimension, words]) => 
                    words.map(word => `<span class="result-word">${word}</span>`).join('')
                ).join('');
            
            resultElement.innerHTML = `
                <div class="result-header">
                    <div class="result-title">💡 创意 #${result.index}</div>
                    <div style="font-size: 0.9rem; color: #718096;">
                        ${result.timestamp.toLocaleTimeString()}
                    </div>
                </div>
                <div class="result-words">${wordsHtml}</div>
                <div class="result-content">
                    ${result.success ? 
                        result.aiContent.replace(/\n/g, '<br>') : 
                        '⚠️ AI生成失败，请重试'
                    }
                </div>
            `;
            
            this.elements.resultsList.appendChild(resultElement);
        });
    }
    
    /**
     * 设置生成状态
     */
    setGeneratingStatus(isGenerating) {
        this.isGenerating = isGenerating;
        
        if (this.elements.generateButton) {
            this.elements.generateButton.disabled = isGenerating;
            this.elements.generateButton.textContent = isGenerating ? 
                '🔄 生成中...' : '🚀 开始生成创意';
        }
    }
    
    /**
     * 构建游戏创意生成的提示词
     */
    buildGameIdeaPrompt(dimensions, wordsByDimension) {
        const wordList = Object.entries(wordsByDimension)
            .map(([dim, words]) => `${dim}: ${words.join(', ')}`)
            .join('\n');
        
        return `请根据以下创意元素生成一个有趣的游戏创意：

创意元素：
${wordList}

请生成一个详细的游戏创意描述，包括：
1. 游戏核心玩法
2. 背景设定
3. 特色机制
4. 目标受众

要求：创意新颖有趣，富有想象力，字数控制在200字以内。`;
    }
    
    /**
     * 更新数量显示
     */
    updateCountDisplay() {
        if (this.elements.generationCount && this.elements.countDisplay) {
            this.elements.countDisplay.textContent = this.elements.generationCount.value;
        }
    }
    
    /**
     * 更新服务商设置
     */
    updateProviderSettings() {
        if (!this.elements.aiProvider || !window.aiService) return;
        
        const provider = this.elements.aiProvider.value;
        // 这里暂时跳过自动填写URL，因为需要更多的API支持
        // 未来可以通过 getAvailableProviders 方法获取提供商信息
    }
    
    /**
     * 保存设置
     */
    saveSettings() {
        const provider = this.elements.aiProvider?.value;
        const apiKey = this.elements.apiKey?.value;
        const apiUrl = this.elements.apiUrl?.value;
        
        if (provider && apiKey && window.aiService) {
            try {
                // 暂时使用setProvider方法（如果存在）
                if (window.aiService.setProvider) {
                    window.aiService.setProvider(provider, { apiKey, baseUrl: apiUrl });
                    this.addSystemMessage('设置保存成功喵～');
                } else {
                    this.addSystemMessage('保存功能暂未实现，请稍后重试喵～');
                }
            } catch (error) {
                console.error('Failed to save AI settings:', error);
                this.addSystemMessage('设置保存失败喵～ 请检查配置信息');
            }
        } else {
            alert('请填写完整的API配置信息');
        }
    }
    
    /**
     * 重置设置
     */
    resetSettings() {
        if (confirm('确定要重置所有设置吗？')) {
            localStorage.removeItem('indienstein_ai_settings');
            localStorage.removeItem('indienstein_custom_words');
            location.reload();
        }
    }
    
    /**
     * 加载设置
     */
    loadSettings() {
        // 加载AI设置（检查服务是否可用）
        const aiSettings = window.aiService;
        if (aiSettings) {
            if (this.elements.aiProvider) {
                this.elements.aiProvider.value = aiSettings.currentProvider;
            }
            if (this.elements.apiKey) {
                this.elements.apiKey.value = aiSettings.apiKey;
            }
            if (this.elements.apiUrl) {
                this.elements.apiUrl.value = aiSettings.apiUrl;
            }
        }
        
        // 加载主题设置
        const savedTheme = localStorage.getItem('indienstein_theme') || 'light';
        if (this.elements.themeSelect) {
            this.elements.themeSelect.value = savedTheme;
        }
        this.applyTheme(savedTheme);
    }
    
    /**
     * 应用主题
     */
    applyTheme(theme) {
        document.body.className = theme === 'dark' ? 'dark-theme' : '';
    }
}

// 全局函数供HTML调用
window.switchTab = function(tabName) {
    if (window.uiManager) {
        window.uiManager.switchTab(tabName);
    }
};

window.saveSettings = function() {
    if (window.uiManager) {
        window.uiManager.saveSettings();
    }
};

window.resetSettings = function() {
    if (window.uiManager) {
        window.uiManager.resetSettings();
    }
};

// 导出UIManager类供其他模块使用
window.UIManager = UIManager; 