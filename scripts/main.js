/**
 * Indienstein - AI游戏创意生成器
 * 应用核心启动文件 - Application Core
 * 
 * @author JtheWL (术士木星)
 * @version 1.0.0
 */

// 全局应用配置
const AppConfig = {
    name: 'Indienstein',
    version: '1.0.0',
    description: 'AI游戏创意生成器',
    author: 'JtheWL',
    github: 'https://github.com/JupiterTheWarlock/Indienstein-by-JtheWL',
    
    // 模块配置
    modules: {
        'ai-service': { required: true, priority: 1 },
        'word-generator': { required: true, priority: 2 },
        'ui-manager': { required: true, priority: 3 }
    },
    
    // 性能配置
    performance: {
        enableMonitoring: true,
        enableLazyLoading: true,
        debounceDelay: 300
    },
    
    // 存储配置
    storage: {
        prefix: 'indienstein_',
        quotaLimit: 5 * 1024 * 1024 // 5MB
    }
};

// 全局应用状态
const AppState = {
    user: {
        settings: {},
        preferences: {
            theme: 'auto',
            language: 'zh-CN',
            animations: true
        }
    },
    ai: {
        currentProvider: 'qwen',
        currentAssistant: 'eggcat',
        conversations: []
    },
    generator: {
        selectedDimensions: [],
        generationHistory: [],
        currentResults: []
    },
    ui: {
        currentTab: 'home',
        activeModals: [],
        loadingStates: {}
    }
};

/**
 * 全局事件总线
 */
class EventBus {
    constructor() {
        this.events = new Map();
        this.maxListeners = 50;
    }
    
    on(event, callback, options = {}) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        
        const listeners = this.events.get(event);
        if (listeners.length >= this.maxListeners) {
            console.warn(`EventBus: Too many listeners for event '${event}'`);
        }
        
        const listenerObj = {
            callback,
            once: options.once || false,
            priority: options.priority || 0
        };
        
        listeners.push(listenerObj);
        listeners.sort((a, b) => b.priority - a.priority);
    }
    
    once(event, callback, options = {}) {
        this.on(event, callback, { ...options, once: true });
    }
    
    emit(event, data = null) {
        if (this.events.has(event)) {
            const listeners = this.events.get(event).slice();
            
            for (let i = listeners.length - 1; i >= 0; i--) {
                const listener = listeners[i];
                try {
                    listener.callback(data);
                    
                    if (listener.once) {
                        listeners.splice(i, 1);
                    }
                } catch (error) {
                    console.error(`EventBus error in '${event}' listener:`, error);
                }
            }
            
            this.events.set(event, listeners);
        }
    }
    
    off(event, callback) {
        if (this.events.has(event)) {
            const listeners = this.events.get(event);
            const index = listeners.findIndex(l => l.callback === callback);
            if (index >= 0) {
                listeners.splice(index, 1);
            }
        }
    }
    
    clear(event) {
        if (event) {
            this.events.delete(event);
        } else {
            this.events.clear();
        }
    }
}

/**
 * 存储管理器
 */
class StorageManager {
    static prefix = AppConfig.storage.prefix;
    static quotaLimit = AppConfig.storage.quotaLimit;
    
    static set(key, value) {
        try {
            const fullKey = this.prefix + key;
            const serialized = JSON.stringify({
                data: value,
                timestamp: Date.now(),
                version: AppConfig.version
            });
            
            // 检查存储配额
            if (this.getStorageSize() + serialized.length > this.quotaLimit) {
                this.cleanup();
            }
            
            localStorage.setItem(fullKey, serialized);
            return true;
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.warn('Storage quota exceeded, attempting cleanup...');
                this.cleanup();
                try {
                    localStorage.setItem(this.prefix + key, JSON.stringify(value));
                    return true;
                } catch (e) {
                    console.error('Storage failed after cleanup:', e);
                }
            } else {
                console.error('Storage error:', error);
            }
            return false;
        }
    }
    
    static get(key, defaultValue = null) {
        try {
            const fullKey = this.prefix + key;
            const item = localStorage.getItem(fullKey);
            if (!item) return defaultValue;
            
            const parsed = JSON.parse(item);
            
            // 检查版本兼容性
            if (parsed.version && parsed.version !== AppConfig.version) {
                console.info(`Migrating storage data for key '${key}'`);
                // 这里可以添加数据迁移逻辑
            }
            
            return parsed.data || defaultValue;
        } catch (error) {
            console.error(`Storage read error for key '${key}':`, error);
            return defaultValue;
        }
    }
    
    static remove(key) {
        try {
            localStorage.removeItem(this.prefix + key);
            return true;
        } catch (error) {
            console.error(`Storage remove error for key '${key}':`, error);
            return false;
        }
    }
    
    static clear() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.prefix)) {
                    localStorage.removeItem(key);
                }
            });
            return true;
        } catch (error) {
            console.error('Storage clear error:', error);
            return false;
        }
    }
    
    static getStorageSize() {
        let total = 0;
        for (let key in localStorage) {
            if (key.startsWith(this.prefix)) {
                total += localStorage[key].length;
            }
        }
        return total;
    }
    
    static cleanup() {
        try {
            // 删除过期数据（超过30天）
            const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
            
            for (let key in localStorage) {
                if (key.startsWith(this.prefix)) {
                    try {
                        const data = JSON.parse(localStorage[key]);
                        if (data.timestamp && data.timestamp < cutoff) {
                            localStorage.removeItem(key);
                        }
                    } catch (e) {
                        // 删除损坏的数据
                        localStorage.removeItem(key);
                    }
                }
            }
        } catch (error) {
            console.error('Storage cleanup error:', error);
        }
    }
    
    static exportData() {
        const data = {};
        for (let key in localStorage) {
            if (key.startsWith(this.prefix)) {
                const cleanKey = key.replace(this.prefix, '');
                data[cleanKey] = this.get(cleanKey);
            }
        }
        return data;
    }
    
    static importData(data) {
        try {
            for (let key in data) {
                this.set(key, data[key]);
            }
            return true;
        } catch (error) {
            console.error('Data import error:', error);
            return false;
        }
    }
}

/**
 * 模块加载器
 */
class ModuleLoader {
    constructor() {
        this.loadedModules = new Map();
        this.loadingPromises = new Map();
        this.dependencyGraph = new Map();
    }
    
    async loadModule(name) {
        // 如果已经加载，直接返回
        if (this.loadedModules.has(name)) {
            return this.loadedModules.get(name);
        }
        
        // 如果正在加载，返回加载Promise
        if (this.loadingPromises.has(name)) {
            return this.loadingPromises.get(name);
        }
        
        const loadPromise = this._loadModuleScript(name);
        this.loadingPromises.set(name, loadPromise);
        
        try {
            const module = await loadPromise;
            this.loadedModules.set(name, module);
            this.loadingPromises.delete(name);
            
            console.info(`Module '${name}' loaded successfully`);
            return module;
        } catch (error) {
            this.loadingPromises.delete(name);
            console.error(`Failed to load module '${name}':`, error);
            throw error;
        }
    }
    
    async _loadModuleScript(name) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `scripts/${name}.js`;
            script.async = true;
            
            script.onload = () => {
                // 检查模块是否正确导出
                const moduleVar = this._getModuleVariable(name);
                if (window[moduleVar]) {
                    resolve(window[moduleVar]);
                } else {
                    reject(new Error(`Module '${name}' did not export expected variable '${moduleVar}'`));
                }
            };
            
            script.onerror = () => {
                reject(new Error(`Failed to load script for module '${name}'`));
            };
            
            document.head.appendChild(script);
            
            // 设置加载超时
            setTimeout(() => {
                if (script.parentNode) {
                    script.parentNode.removeChild(script);
                    reject(new Error(`Module '${name}' load timeout`));
                }
            }, 10000);
        });
    }
    
    _getModuleVariable(name) {
        // 将模块名转换为对应的全局变量名
        // 特殊处理某些模块名以匹配实际的导出变量名
        const moduleNameMap = {
            'ai-service': 'AIService',
            'word-generator': 'WordGenerator',
            'ui-manager': 'UIManager'
        };
        
        if (moduleNameMap[name]) {
            return moduleNameMap[name];
        }
        
        // 默认转换逻辑
        const varName = name.split('-').map(part => 
            part.charAt(0).toUpperCase() + part.slice(1)
        ).join('');
        return varName;
    }
    
    async loadModules(moduleNames) {
        const loadPromises = moduleNames.map(name => this.loadModule(name));
        return Promise.all(loadPromises);
    }
    
    isLoaded(name) {
        return this.loadedModules.has(name);
    }
    
    getModule(name) {
        return this.loadedModules.get(name);
    }
}

/**
 * 性能监控器
 */
class PerformanceMonitor {
    constructor() {
        this.marks = new Map();
        this.measures = new Map();
        this.enabled = AppConfig.performance.enableMonitoring;
    }
    
    mark(name) {
        if (!this.enabled) return;
        
        try {
            performance.mark(name);
            this.marks.set(name, performance.now());
        } catch (error) {
            console.warn('Performance mark failed:', error);
        }
    }
    
    measure(name, startMark, endMark) {
        if (!this.enabled) return;
        
        try {
            if (endMark) {
                performance.measure(name, startMark, endMark);
            } else {
                performance.measure(name, startMark);
            }
            
            const entries = performance.getEntriesByName(name, 'measure');
            if (entries.length > 0) {
                const duration = entries[entries.length - 1].duration;
                this.measures.set(name, duration);
                
                if (duration > 1000) {
                    console.warn(`Performance: ${name} took ${duration.toFixed(2)}ms`);
                } else {
                    console.info(`Performance: ${name} took ${duration.toFixed(2)}ms`);
                }
                
                return duration;
            }
        } catch (error) {
            console.warn('Performance measure failed:', error);
        }
        
        return 0;
    }
    
    getMetrics() {
        if (!this.enabled) return {};
        
        return {
            marks: Object.fromEntries(this.marks),
            measures: Object.fromEntries(this.measures),
            navigation: performance.getEntriesByType('navigation')[0],
            memory: performance.memory ? {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
            } : null
        };
    }
    
    clearMetrics() {
        if (!this.enabled) return;
        
        try {
            performance.clearMarks();
            performance.clearMeasures();
            this.marks.clear();
            this.measures.clear();
        } catch (error) {
            console.warn('Performance clear failed:', error);
        }
    }
}

/**
 * 错误处理器
 */
class ErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 100;
        this.setupGlobalHandlers();
    }
    
    setupGlobalHandlers() {
        // 捕获 JavaScript 错误
        window.addEventListener('error', (event) => {
            this.handleError({
                type: 'javascript',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack,
                timestamp: Date.now()
            });
        });
        
        // 捕获 Promise 拒绝
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError({
                type: 'promise',
                message: event.reason?.message || 'Unhandled promise rejection',
                reason: event.reason,
                timestamp: Date.now()
            });
        });
        
        // 捕获资源加载错误
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                this.handleError({
                    type: 'resource',
                    message: `Failed to load resource: ${event.target.src || event.target.href}`,
                    target: event.target.tagName,
                    timestamp: Date.now()
                });
            }
        }, true);
    }
    
    handleError(error) {
        console.error('Application Error:', error);
        
        // 存储错误信息
        this.errors.push(error);
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }
        
        // 发送错误事件
        if (window.app?.eventBus) {
            window.app.eventBus.emit('error', error);
        }
        
        // 保存到本地存储（用于调试）
        StorageManager.set('errors', this.errors.slice(-10));
    }
    
    getErrors() {
        return this.errors;
    }
    
    clearErrors() {
        this.errors = [];
        StorageManager.remove('errors');
    }
}

/**
 * 应用核心类
 */
class Application {
    constructor() {
        this.config = AppConfig;
        this.state = AppState;
        this.eventBus = new EventBus();
        this.moduleLoader = new ModuleLoader();
        this.performanceMonitor = new PerformanceMonitor();
        this.errorHandler = new ErrorHandler();
        this.services = new Map();
        this.initialized = false;
    }
    
    async initialize() {
        if (this.initialized) {
            console.warn('Application already initialized');
            return;
        }
        
        this.performanceMonitor.mark('app-init-start');
        
        try {
            console.info(`Initializing ${this.config.name} v${this.config.version}`);
            
            // 1. 浏览器兼容性检查
            await this.checkBrowserCompatibility();
            
            // 2. 加载用户设置
            await this.loadUserSettings();
            
            // 3. 加载核心模块
            await this.loadCoreModules();
            
            // 4. 初始化服务
            await this.initializeServices();
            
            // 5. 绑定全局事件
            this.bindGlobalEvents();
            
            // 6. 启动应用
            await this.startApplication();
            
            this.initialized = true;
            this.performanceMonitor.mark('app-init-end');
            this.performanceMonitor.measure('app-initialization', 'app-init-start', 'app-init-end');
            
            console.info('Application initialized successfully');
            this.eventBus.emit('app:initialized');
            
        } catch (error) {
            this.errorHandler.handleError({
                type: 'initialization',
                message: 'Application initialization failed',
                error: error,
                timestamp: Date.now()
            });
            
            this.showErrorScreen(error);
            throw error;
        }
    }
    
    async checkBrowserCompatibility() {
        const required = {
            es6: () => {
                try {
                    eval('const test = () => {}; class Test {}');
                    return true;
                } catch (e) {
                    return false;
                }
            },
            fetch: () => typeof fetch !== 'undefined',
            localStorage: () => {
                try {
                    localStorage.setItem('test', 'test');
                    localStorage.removeItem('test');
                    return true;
                } catch (e) {
                    return false;
                }
            },
            promise: () => typeof Promise !== 'undefined',
            asyncAwait: () => {
                try {
                    eval('async function test() { await Promise.resolve(); }');
                    return true;
                } catch (e) {
                    return false;
                }
            }
        };
        
        const missing = [];
        for (const [feature, check] of Object.entries(required)) {
            if (!check()) {
                missing.push(feature);
            }
        }
        
        if (missing.length > 0) {
            throw new Error(`Browser not supported. Missing features: ${missing.join(', ')}`);
        }
    }
    
    async loadUserSettings() {
        const settings = StorageManager.get('settings', {});
        const preferences = StorageManager.get('preferences', this.state.user.preferences);
        
        this.state.user.settings = { ...this.state.user.settings, ...settings };
        this.state.user.preferences = { ...this.state.user.preferences, ...preferences };
        
        // 应用主题设置
        if (preferences.theme) {
            document.documentElement.setAttribute('data-theme', preferences.theme);
        }
    }
    
    async loadCoreModules() {
        const moduleNames = Object.keys(this.config.modules)
            .sort((a, b) => this.config.modules[a].priority - this.config.modules[b].priority);
        
        this.performanceMonitor.mark('modules-load-start');
        
        for (const moduleName of moduleNames) {
            try {
                this.performanceMonitor.mark(`module-${moduleName}-start`);
                await this.moduleLoader.loadModule(moduleName);
                this.performanceMonitor.mark(`module-${moduleName}-end`);
                this.performanceMonitor.measure(`module-${moduleName}`, 
                    `module-${moduleName}-start`, `module-${moduleName}-end`);
            } catch (error) {
                if (this.config.modules[moduleName].required) {
                    throw new Error(`Failed to load required module: ${moduleName}`);
                } else {
                    console.warn(`Failed to load optional module: ${moduleName}`, error);
                }
            }
        }
        
        this.performanceMonitor.mark('modules-load-end');
        this.performanceMonitor.measure('modules-loading', 'modules-load-start', 'modules-load-end');
    }
    
    async initializeServices() {
        // 初始化AI服务
        if (this.moduleLoader.isLoaded('ai-service')) {
            const AIService = this.moduleLoader.getModule('ai-service');
            const aiService = new AIService(this.eventBus, this.state);
            this.services.set('ai', aiService);
            // 立即挂载到全局对象供其他模块使用
            window.aiService = aiService;
        }
        
        // 初始化词汇生成器
        if (this.moduleLoader.isLoaded('word-generator')) {
            const WordGenerator = this.moduleLoader.getModule('word-generator');
            const wordGenerator = new WordGenerator(this.eventBus, this.state);
            this.services.set('wordGenerator', wordGenerator);
            // 立即挂载到全局对象供其他模块使用
            window.wordGenerator = wordGenerator;
        }
        
        // 初始化UI管理器
        if (this.moduleLoader.isLoaded('ui-manager')) {
            const UIManager = this.moduleLoader.getModule('ui-manager');
            const uiManager = new UIManager(this.eventBus, this.state);
            this.services.set('ui', uiManager);
            // 更新全局的uiManager实例
            window.uiManager = uiManager;
        }
        
        // 等待所有服务初始化完成
        const initPromises = [];
        for (const [name, service] of this.services) {
            if (service.initialize) {
                initPromises.push(service.initialize().catch(error => {
                    console.error(`Service '${name}' initialization failed:`, error);
                    throw error;
                }));
            }
        }
        
        await Promise.all(initPromises);
    }
    
    bindGlobalEvents() {
        // 窗口大小变化
        window.addEventListener('resize', this.debounce(() => {
            this.eventBus.emit('window:resize', {
                width: window.innerWidth,
                height: window.innerHeight
            });
        }, AppConfig.performance.debounceDelay));
        
        // 页面可见性变化
        document.addEventListener('visibilitychange', () => {
            this.eventBus.emit('page:visibilitychange', {
                hidden: document.hidden
            });
        });
        
        // 网络状态变化
        if ('onLine' in navigator) {
            window.addEventListener('online', () => {
                this.eventBus.emit('network:online');
            });
            
            window.addEventListener('offline', () => {
                this.eventBus.emit('network:offline');
            });
        }
        
        // 键盘快捷键
        document.addEventListener('keydown', (event) => {
            this.eventBus.emit('keyboard:shortcut', {
                key: event.key,
                code: event.code,
                ctrlKey: event.ctrlKey,
                altKey: event.altKey,
                shiftKey: event.shiftKey,
                metaKey: event.metaKey
            });
        });
    }
    
    async startApplication() {
        // 隐藏加载屏幕
        this.hideLoadingScreen();
        
        // 启动UI
        const uiService = this.services.get('ui');
        if (uiService) {
            await uiService.start();
        }
        
        // 发送应用启动事件
        this.eventBus.emit('app:started');
    }
    
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 300);
        }
    }
    
    showErrorScreen(error) {
        const errorScreen = document.createElement('div');
        errorScreen.className = 'error-screen';
        errorScreen.innerHTML = `
            <div class="error-content">
                <h2>应用启动失败 😿</h2>
                <p>很抱歉，应用在启动过程中遇到了问题。</p>
                <details>
                    <summary>错误详情</summary>
                    <pre>${error.message}\n${error.stack || ''}</pre>
                </details>
                <button onclick="location.reload()">重新加载</button>
            </div>
        `;
        
        document.body.appendChild(errorScreen);
    }
    
    // 工具方法
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    // 公共API
    getService(name) {
        return this.services.get(name);
    }
    
    getState() {
        return this.state;
    }
    
    setState(path, value) {
        const keys = path.split('.');
        let obj = this.state;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!(keys[i] in obj)) {
                obj[keys[i]] = {};
            }
            obj = obj[keys[i]];
        }
        
        obj[keys[keys.length - 1]] = value;
        this.eventBus.emit('state:changed', { path, value });
    }
    
    saveSettings() {
        StorageManager.set('settings', this.state.user.settings);
        StorageManager.set('preferences', this.state.user.preferences);
    }
    
    exportData() {
        return {
            settings: this.state.user.settings,
            preferences: this.state.user.preferences,
            conversations: this.state.ai.conversations,
            generationHistory: this.state.generator.generationHistory
        };
    }
    
    importData(data) {
        try {
            if (data.settings) {
                this.state.user.settings = { ...this.state.user.settings, ...data.settings };
            }
            if (data.preferences) {
                this.state.user.preferences = { ...this.state.user.preferences, ...data.preferences };
            }
            if (data.conversations) {
                this.state.ai.conversations = data.conversations;
            }
            if (data.generationHistory) {
                this.state.generator.generationHistory = data.generationHistory;
            }
            
            this.saveSettings();
            this.eventBus.emit('data:imported');
            return true;
        } catch (error) {
            console.error('Data import failed:', error);
            return false;
        }
    }
}

// 全局应用实例
window.app = null;

// 启动应用
document.addEventListener('DOMContentLoaded', async () => {
    try {
        window.app = new Application();
        await window.app.initialize();
    } catch (error) {
        console.error('Application startup failed:', error);
    }
});

// 全局导出（供其他模块使用）
window.AppConfig = AppConfig;
window.AppState = AppState;
window.StorageManager = StorageManager;
window.EventBus = EventBus; 