/**
 * AI Service Module - AI服务管理模块
 * 实现AI提供商抽象层、会话管理和安全处理
 * 
 * @author JtheWL (术士木星)
 * @version 1.0.0
 */

/**
 * AI提供商基类
 */
class AIProvider {
    constructor(config) {
        this.config = this.validateConfig(config);
        this.rateLimiter = new RateLimiter(config.rateLimit);
        this.requestQueue = [];
        this.isProcessing = false;
    }
    
    validateConfig() {
        throw new Error('validateConfig must be implemented by subclass');
    }
    
    async sendMessage(message, options = {}) {
        throw new Error('sendMessage must be implemented by subclass');
    }
    
    async streamMessage(message, onChunk, options = {}) {
        throw new Error('streamMessage must be implemented by subclass');
    }
    
    getModels() {
        throw new Error('getModels must be implemented by subclass');
    }
    
    getName() {
        return this.config.name || 'Unknown Provider';
    }
    
    isConfigured() {
        return !!(this.config.apiKey && this.config.baseUrl);
    }
}

/**
 * 通义千问提供商
 */
class QwenProvider extends AIProvider {
    constructor(config) {
        super({
            name: 'qwen',
            baseUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
            defaultModel: 'qwen-plus',
            rateLimit: { requests: 60, window: 60000 }, // 60 requests per minute
            ...config
        });
    }
    
    validateConfig(config) {
        if (!config.apiKey) {
            throw new Error('Qwen API key is required');
        }
        return config;
    }
    
    async sendMessage(message, options = {}) {
        await this.rateLimiter.waitForSlot();
        
        const payload = this.buildPayload(message, options);
        
        try {
            const response = await this.makeRequest(payload);
            return this.parseResponse(response);
        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }
    
    async streamMessage(message, onChunk, options = {}) {
        await this.rateLimiter.waitForSlot();
        
        const payload = this.buildPayload(message, { ...options, stream: true });
        
        try {
            await this.makeStreamRequest(payload, onChunk);
        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }
    
    buildPayload(message, options = {}) {
        const { model = this.config.defaultModel, temperature = 0.7, maxTokens = 2000 } = options;
        
        return {
            model,
            input: {
                messages: this.formatMessages(message, options)
            },
            parameters: {
                temperature,
                max_tokens: maxTokens,
                result_format: 'message',
                incremental_output: options.stream || false
            }
        };
    }
    
    formatMessages(message, options = {}) {
        const { systemPrompt, conversationHistory = [] } = options;
        const messages = [];
        
        // 添加系统提示
        if (systemPrompt) {
            messages.push({
                role: 'system',
                content: systemPrompt
            });
        }
        
        // 添加对话历史
        messages.push(...conversationHistory);
        
        // 添加当前消息
        messages.push({
            role: 'user',
            content: message
        });
        
        return messages;
    }
    
    async makeRequest(payload) {
        const response = await fetch(this.config.baseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json',
                'X-DashScope-SSE': 'disable'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new AIServiceError(`HTTP ${response.status}: ${response.statusText}`, {
                status: response.status,
                provider: 'qwen'
            });
        }
        
        return response.json();
    }
    
    async makeStreamRequest(payload, onChunk) {
        const response = await fetch(this.config.baseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream',
                'X-DashScope-SSE': 'enable'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new AIServiceError(`HTTP ${response.status}: ${response.statusText}`, {
                status: response.status,
                provider: 'qwen'
            });
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.substring(6);
                        if (data.trim() === '[DONE]') return;
                        
                        try {
                            const parsed = JSON.parse(data);
                            const content = this.extractStreamContent(parsed);
                            if (content) {
                                onChunk(content);
                            }
                        } catch (e) {
                            console.warn('Failed to parse stream chunk:', e);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }
    
    parseResponse(response) {
        if (response.output && response.output.choices && response.output.choices[0]) {
            return {
                content: response.output.choices[0].message.content,
                finishReason: response.output.choices[0].finish_reason,
                usage: response.usage
            };
        }
        
        throw new AIServiceError('Invalid response format from Qwen API');
    }
    
    extractStreamContent(data) {
        if (data.output && data.output.choices && data.output.choices[0]) {
            return data.output.choices[0].message.content;
        }
        return null;
    }
    
    getModels() {
        return [
            { id: 'qwen-plus', name: 'Qwen Plus', description: '通义千问Plus模型' },
            { id: 'qwen-turbo', name: 'Qwen Turbo', description: '通义千问Turbo模型' },
            { id: 'qwen-max', name: 'Qwen Max', description: '通义千问Max模型' }
        ];
    }
    
    handleError(error) {
        console.error('Qwen Provider Error:', error);
        
        // 记录错误用于分析
        if (window.app?.errorHandler) {
            window.app.errorHandler.handleError({
                type: 'ai-provider',
                provider: 'qwen',
                error: error,
                timestamp: Date.now()
            });
        }
    }
}

/**
 * OpenAI提供商
 */
class OpenAIProvider extends AIProvider {
    constructor(config) {
        super({
            name: 'openai',
            baseUrl: 'https://api.openai.com/v1/chat/completions',
            defaultModel: 'gpt-3.5-turbo',
            rateLimit: { requests: 20, window: 60000 }, // 20 requests per minute
            ...config
        });
    }
    
    validateConfig(config) {
        if (!config.apiKey) {
            throw new Error('OpenAI API key is required');
        }
        return config;
    }
    
    async sendMessage(message, options = {}) {
        await this.rateLimiter.waitForSlot();
        
        const payload = this.buildPayload(message, options);
        
        try {
            const response = await this.makeRequest(payload);
            return this.parseResponse(response);
        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }
    
    async streamMessage(message, onChunk, options = {}) {
        await this.rateLimiter.waitForSlot();
        
        const payload = this.buildPayload(message, { ...options, stream: true });
        
        try {
            await this.makeStreamRequest(payload, onChunk);
        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }
    
    buildPayload(message, options = {}) {
        const { model = this.config.defaultModel, temperature = 0.7, maxTokens = 2000 } = options;
        
        return {
            model,
            messages: this.formatMessages(message, options),
            temperature,
            max_tokens: maxTokens,
            stream: options.stream || false
        };
    }
    
    formatMessages(message, options = {}) {
        const { systemPrompt, conversationHistory = [] } = options;
        const messages = [];
        
        if (systemPrompt) {
            messages.push({
                role: 'system',
                content: systemPrompt
            });
        }
        
        messages.push(...conversationHistory);
        
        messages.push({
            role: 'user',
            content: message
        });
        
        return messages;
    }
    
    async makeRequest(payload) {
        const response = await fetch(this.config.baseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new AIServiceError(`HTTP ${response.status}: ${response.statusText}`, {
                status: response.status,
                provider: 'openai'
            });
        }
        
        return response.json();
    }
    
    async makeStreamRequest(payload, onChunk) {
        const response = await fetch(this.config.baseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new AIServiceError(`HTTP ${response.status}: ${response.statusText}`, {
                status: response.status,
                provider: 'openai'
            });
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.substring(6);
                        if (data.trim() === '[DONE]') return;
                        
                        try {
                            const parsed = JSON.parse(data);
                            const content = this.extractStreamContent(parsed);
                            if (content) {
                                onChunk(content);
                            }
                        } catch (e) {
                            console.warn('Failed to parse stream chunk:', e);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }
    
    parseResponse(response) {
        if (response.choices && response.choices[0]) {
            return {
                content: response.choices[0].message.content,
                finishReason: response.choices[0].finish_reason,
                usage: response.usage
            };
        }
        
        throw new AIServiceError('Invalid response format from OpenAI API');
    }
    
    extractStreamContent(data) {
        if (data.choices && data.choices[0] && data.choices[0].delta) {
            return data.choices[0].delta.content || '';
        }
        return null;
    }
    
    getModels() {
        return [
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and efficient model' },
            { id: 'gpt-4', name: 'GPT-4', description: 'Most capable model' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Latest GPT-4 model' }
        ];
    }
    
    handleError(error) {
        console.error('OpenAI Provider Error:', error);
        
        if (window.app?.errorHandler) {
            window.app.errorHandler.handleError({
                type: 'ai-provider',
                provider: 'openai',
                error: error,
                timestamp: Date.now()
            });
        }
    }
}

/**
 * 速率限制器
 */
class RateLimiter {
    constructor(config = {}) {
        this.requests = config.requests || 60;
        this.window = config.window || 60000; // 1 minute
        this.requestTimes = [];
    }
    
    async waitForSlot() {
        const now = Date.now();
        
        // 清理过期的请求记录
        this.requestTimes = this.requestTimes.filter(time => now - time < this.window);
        
        // 如果当前请求数未达到限制，直接通过
        if (this.requestTimes.length < this.requests) {
            this.requestTimes.push(now);
            return;
        }
        
        // 计算需要等待的时间
        const oldestRequest = Math.min(...this.requestTimes);
        const waitTime = this.window - (now - oldestRequest);
        
        if (waitTime > 0) {
            console.info(`Rate limit reached, waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return this.waitForSlot(); // 递归检查
        }
        
        this.requestTimes.push(now);
    }
}

/**
 * AI服务错误类
 */
class AIServiceError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'AIServiceError';
        this.details = details;
        this.timestamp = Date.now();
    }
}

/**
 * AI助手配置
 */
const AI_ASSISTANTS = {
    eggcat: {
        name: 'EggCat',
        displayName: '🐱 EggCat',
        description: '可爱的猫娘AI助手，轻松愉快的创意交流',
        systemPrompt: `你是EggCat，一个可爱的猫娘AI助手，专门帮助用户进行游戏创意设计。你的特点：
- 说话时会加上"喵"、"呢"等语气词
- 性格活泼可爱，充满创意
- 擅长将复杂的概念用简单有趣的方式表达
- 对游戏设计充满热情
- 经常使用表情符号和可爱的比喻

请以这个人格回答用户的问题，帮助他们进行游戏创意生成和讨论。`
    },
    
    creative: {
        name: 'creative',
        displayName: '💡 创意助手',
        description: '专业的游戏设计顾问，深度分析创意可行性',
        systemPrompt: `你是一名资深的游戏设计顾问，拥有丰富的游戏开发经验。你的专长包括：
- 游戏机制设计和平衡
- 玩家体验分析
- 市场趋势洞察
- 技术可行性评估
- 创意优化建议

请用专业而友好的语调回答问题，为用户提供有深度的游戏设计建议和创意分析。`
    },
    
    technical: {
        name: 'technical',
        displayName: '🔧 技术顾问',
        description: '技术导向的AI，关注实现方案和技术细节',
        systemPrompt: `你是一名技术导向的游戏开发顾问，专注于技术实现和开发细节。你的专长包括：
- 游戏引擎技术
- 编程最佳实践
- 性能优化
- 架构设计
- 技术选型建议

请从技术实现的角度分析和回答问题，提供实用的开发建议和解决方案。`
    }
};

/**
 * 会话管理器
 */
class ConversationManager {
    constructor() {
        this.conversations = new Map();
        this.maxHistoryLength = 50;
        this.compressionThreshold = 30;
    }
    
    createConversation(assistantId = 'eggcat') {
        const conversationId = this.generateId();
        const conversation = {
            id: conversationId,
            assistantId,
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        this.conversations.set(conversationId, conversation);
        return conversationId;
    }
    
    addMessage(conversationId, role, content) {
        const conversation = this.conversations.get(conversationId);
        if (!conversation) {
            throw new Error(`Conversation ${conversationId} not found`);
        }
        
        const message = {
            id: this.generateId(),
            role,
            content,
            timestamp: Date.now()
        };
        
        conversation.messages.push(message);
        conversation.updatedAt = Date.now();
        
        // 检查是否需要压缩历史
        if (conversation.messages.length > this.maxHistoryLength) {
            this.compressHistory(conversation);
        }
        
        return message.id;
    }
    
    getConversation(conversationId) {
        return this.conversations.get(conversationId);
    }
    
    getConversationHistory(conversationId, limit = 10) {
        const conversation = this.conversations.get(conversationId);
        if (!conversation) return [];
        
        return conversation.messages
            .slice(-limit)
            .map(msg => ({
                role: msg.role,
                content: msg.content
            }));
    }
    
    getAllConversations() {
        return Array.from(this.conversations.values())
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }
    
    deleteConversation(conversationId) {
        return this.conversations.delete(conversationId);
    }
    
    compressHistory(conversation) {
        // 保留最近的消息，压缩较早的消息
        const recentMessages = conversation.messages.slice(-this.compressionThreshold);
        const oldMessages = conversation.messages.slice(0, -this.compressionThreshold);
        
        if (oldMessages.length > 0) {
            // 创建摘要消息
            const summary = this.createSummary(oldMessages);
            conversation.messages = [summary, ...recentMessages];
        }
    }
    
    createSummary(messages) {
        const summaryContent = `[对话摘要] 之前的对话中讨论了${messages.length}条消息，主要内容包括游戏创意讨论、设计建议等。`;
        
        return {
            id: this.generateId(),
            role: 'system',
            content: summaryContent,
            timestamp: Date.now(),
            isSummary: true
        };
    }
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    exportConversations() {
        return Array.from(this.conversations.values());
    }
    
    importConversations(conversations) {
        this.conversations.clear();
        conversations.forEach(conv => {
            this.conversations.set(conv.id, conv);
        });
    }
}

/**
 * AI服务主类
 */
class AIService {
    constructor(eventBus = null, state = null) {
        this.eventBus = eventBus;
        this.state = state;
        this.providers = new Map();
        this.currentProvider = null;
        this.currentAssistant = 'eggcat';
        this.conversationManager = new ConversationManager();
        this.isInitialized = false;
        
        // 注册默认提供商
        this.registerProvider('qwen', QwenProvider);
        this.registerProvider('openai', OpenAIProvider);
        
        // 绑定事件
        this.bindEvents();
    }
    
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            // 加载保存的配置
            await this.loadConfiguration();
            
            // 加载对话历史
            await this.loadConversations();
            
            this.isInitialized = true;
            console.info('AI Service initialized successfully');
            
            if (this.eventBus) {
                this.eventBus.emit('ai:initialized');
            }
            
        } catch (error) {
            console.error('AI Service initialization failed:', error);
            throw error;
        }
    }
    
    registerProvider(name, ProviderClass) {
        this.providers.set(name, ProviderClass);
    }
    
    async setProvider(name, config = {}) {
        if (!this.providers.has(name)) {
            throw new Error(`AI provider '${name}' not found`);
        }
        
        const ProviderClass = this.providers.get(name);
        
        try {
            this.currentProvider = new ProviderClass(config);
            
            // 保存配置
            if (this.state) {
                this.state.ai.currentProvider = name;
            }
            
            this.saveConfiguration();
            
            if (this.eventBus) {
                this.eventBus.emit('ai:provider-changed', { provider: name });
            }
            
            console.info(`AI provider switched to: ${name}`);
            
        } catch (error) {
            console.error(`Failed to set provider '${name}':`, error);
            throw error;
        }
    }
    
    setAssistant(assistantId) {
        if (!AI_ASSISTANTS[assistantId]) {
            throw new Error(`AI assistant '${assistantId}' not found`);
        }
        
        this.currentAssistant = assistantId;
        
        if (this.state) {
            this.state.ai.currentAssistant = assistantId;
        }
        
        this.saveConfiguration();
        
        if (this.eventBus) {
            this.eventBus.emit('ai:assistant-changed', { assistant: assistantId });
        }
    }
    
    async sendMessage(message, options = {}) {
        if (!this.currentProvider) {
            throw new Error('No AI provider configured');
        }
        
        if (!this.currentProvider.isConfigured()) {
            throw new Error('AI provider not properly configured');
        }
        
        const { conversationId, stream = false } = options;
        
        // 获取助手配置
        const assistant = AI_ASSISTANTS[this.currentAssistant];
        
        // 获取对话历史
        let conversationHistory = [];
        if (conversationId) {
            conversationHistory = this.conversationManager.getConversationHistory(conversationId);
        }
        
        // 构建请求选项
        const requestOptions = {
            systemPrompt: assistant.systemPrompt,
            conversationHistory,
            ...options
        };
        
        try {
            if (stream) {
                return await this.streamMessage(message, requestOptions, conversationId);
            } else {
                const response = await this.currentProvider.sendMessage(message, requestOptions);
                
                // 记录对话
                if (conversationId) {
                    this.conversationManager.addMessage(conversationId, 'user', message);
                    this.conversationManager.addMessage(conversationId, 'assistant', response.content);
                }
                
                return response;
            }
        } catch (error) {
            if (this.eventBus) {
                this.eventBus.emit('ai:error', { error, message });
            }
            throw error;
        }
    }
    
    async streamMessage(message, options = {}, conversationId = null) {
        return new Promise((resolve, reject) => {
            let fullResponse = '';
            
            const onChunk = (chunk) => {
                fullResponse += chunk;
                
                if (this.eventBus) {
                    this.eventBus.emit('ai:stream-chunk', { 
                        chunk, 
                        fullResponse, 
                        conversationId 
                    });
                }
            };
            
            this.currentProvider.streamMessage(message, onChunk, options)
                .then(() => {
                    // 记录对话
                    if (conversationId) {
                        this.conversationManager.addMessage(conversationId, 'user', message);
                        this.conversationManager.addMessage(conversationId, 'assistant', fullResponse);
                    }
                    
                    if (this.eventBus) {
                        this.eventBus.emit('ai:stream-complete', { 
                            fullResponse, 
                            conversationId 
                        });
                    }
                    
                    resolve({ content: fullResponse });
                })
                .catch(reject);
        });
    }
    
    createConversation(assistantId = null) {
        const actualAssistantId = assistantId || this.currentAssistant;
        const conversationId = this.conversationManager.createConversation(actualAssistantId);
        
        if (this.eventBus) {
            this.eventBus.emit('ai:conversation-created', { 
                conversationId, 
                assistantId: actualAssistantId 
            });
        }
        
        return conversationId;
    }
    
    getConversations() {
        return this.conversationManager.getAllConversations();
    }
    
    getConversation(conversationId) {
        return this.conversationManager.getConversation(conversationId);
    }
    
    deleteConversation(conversationId) {
        const success = this.conversationManager.deleteConversation(conversationId);
        
        if (success && this.eventBus) {
            this.eventBus.emit('ai:conversation-deleted', { conversationId });
        }
        
        return success;
    }
    
    getAssistants() {
        return Object.entries(AI_ASSISTANTS).map(([id, config]) => ({
            id,
            ...config
        }));
    }
    
    getCurrentProvider() {
        return this.currentProvider;
    }
    
    getCurrentAssistant() {
        return AI_ASSISTANTS[this.currentAssistant];
    }
    
    getAvailableProviders() {
        return Array.from(this.providers.keys());
    }
    
    getProviderModels(providerName) {
        if (!this.providers.has(providerName)) {
            return [];
        }
        
        const ProviderClass = this.providers.get(providerName);
        const tempProvider = new ProviderClass({ apiKey: 'dummy' });
        return tempProvider.getModels();
    }
    
    bindEvents() {
        if (!this.eventBus) return;
        
        // 监听状态变化
        this.eventBus.on('state:changed', (data) => {
            if (data.path.startsWith('ai.')) {
                this.saveConfiguration();
            }
        });
        
        // 监听应用退出
        this.eventBus.on('app:beforeunload', () => {
            this.saveConversations();
        });
    }
    
    async loadConfiguration() {
        if (!window.StorageManager) return;
        
        const config = window.StorageManager.get('ai-config', {});
        
        if (config.provider) {
            try {
                await this.setProvider(config.provider, config.providerConfig || {});
            } catch (error) {
                console.warn('Failed to restore AI provider:', error);
            }
        }
        
        if (config.assistant) {
            try {
                this.setAssistant(config.assistant);
            } catch (error) {
                console.warn('Failed to restore AI assistant:', error);
            }
        }
    }
    
    saveConfiguration() {
        if (!window.StorageManager) return;
        
        const config = {
            provider: this.currentProvider?.config.name,
            providerConfig: this.currentProvider?.config,
            assistant: this.currentAssistant
        };
        
        window.StorageManager.set('ai-config', config);
    }
    
    async loadConversations() {
        if (!window.StorageManager) return;
        
        const conversations = window.StorageManager.get('ai-conversations', []);
        this.conversationManager.importConversations(conversations);
    }
    
    saveConversations() {
        if (!window.StorageManager) return;
        
        const conversations = this.conversationManager.exportConversations();
        window.StorageManager.set('ai-conversations', conversations);
    }
    
    exportData() {
        return {
            configuration: {
                provider: this.currentProvider?.config.name,
                assistant: this.currentAssistant
            },
            conversations: this.conversationManager.exportConversations()
        };
    }
    
    importData(data) {
        try {
            if (data.conversations) {
                this.conversationManager.importConversations(data.conversations);
            }
            
            if (data.configuration) {
                if (data.configuration.assistant) {
                    this.setAssistant(data.configuration.assistant);
                }
            }
            
            this.saveConfiguration();
            this.saveConversations();
            
            return true;
        } catch (error) {
            console.error('AI data import failed:', error);
            return false;
        }
    }
}

// 导出类供其他模块使用
window.AIService = AIService;
window.AIProvider = AIProvider;
window.QwenProvider = QwenProvider;
window.OpenAIProvider = OpenAIProvider;
window.AIServiceError = AIServiceError;
window.AI_ASSISTANTS = AI_ASSISTANTS; 