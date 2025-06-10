/**
 * Word Generator Module - 词汇生成器模块
 * 实现多维度词汇生成、智能组合和扩展管理
 * 
 * @author JtheWL (术士木星)
 * @version 1.0.0
 */

/**
 * 词库扩展基类
 */
class WordbankExtension {
    constructor(name, data) {
        this.name = name;
        this.version = data.version || '1.0.0';
        this.dimensions = data.dimensions || {};
        this.metadata = data.metadata || {};
        this.author = data.author || 'Unknown';
        this.description = data.description || '';
    }
    
    install(generator) {
        generator.addExtension(this);
    }
    
    uninstall(generator) {
        generator.removeExtension(this.name);
    }
    
    validate() {
        const errors = [];
        
        if (!this.name) {
            errors.push('Extension name is required');
        }
        
        if (!this.dimensions || Object.keys(this.dimensions).length === 0) {
            errors.push('At least one dimension is required');
        }
        
        // 验证维度数据
        for (const [dimName, words] of Object.entries(this.dimensions)) {
            if (!Array.isArray(words)) {
                errors.push(`Dimension '${dimName}' must be an array`);
            } else if (words.length === 0) {
                errors.push(`Dimension '${dimName}' cannot be empty`);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    getDimensionNames() {
        return Object.keys(this.dimensions);
    }
    
    getWordCount() {
        return Object.values(this.dimensions)
            .reduce((total, words) => total + words.length, 0);
    }
}

/**
 * 词汇生成策略
 */
class GenerationStrategy {
    constructor(name, options = {}) {
        this.name = name;
        this.options = options;
    }
    
    generate(dimensions, count, options = {}) {
        throw new Error('generate method must be implemented by subclass');
    }
}

/**
 * 随机生成策略
 */
class RandomStrategy extends GenerationStrategy {
    constructor(options = {}) {
        super('random', options);
    }
    
    generate(dimensions, count, options = {}) {
        const results = [];
        const { allowRepeat = false, excludeWords = [] } = options;
        
        for (let i = 0; i < count; i++) {
            const combination = {};
            
            for (const [dimName, words] of Object.entries(dimensions)) {
                const availableWords = words.filter(word => !excludeWords.includes(word));
                
                if (availableWords.length === 0) {
                    continue;
                }
                
                let selectedWord;
                if (allowRepeat) {
                    selectedWord = this.randomChoice(availableWords);
                } else {
                    // 避免重复选择
                    const usedWords = results.map(r => r[dimName]).filter(Boolean);
                    const unusedWords = availableWords.filter(word => !usedWords.includes(word));
                    selectedWord = this.randomChoice(unusedWords.length > 0 ? unusedWords : availableWords);
                }
                
                combination[dimName] = selectedWord;
            }
            
            results.push(combination);
        }
        
        return results;
    }
    
    randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    }
}

/**
 * 平衡生成策略
 */
class BalancedStrategy extends GenerationStrategy {
    constructor(options = {}) {
        super('balanced', options);
        this.usageStats = new Map();
    }
    
    generate(dimensions, count, options = {}) {
        const results = [];
        
        for (let i = 0; i < count; i++) {
            const combination = {};
            
            for (const [dimName, words] of Object.entries(dimensions)) {
                const selectedWord = this.selectBalancedWord(dimName, words);
                combination[dimName] = selectedWord;
                
                // 更新使用统计
                this.updateUsageStats(dimName, selectedWord);
            }
            
            results.push(combination);
        }
        
        return results;
    }
    
    selectBalancedWord(dimensionName, words) {
        const stats = this.usageStats.get(dimensionName) || new Map();
        
        // 计算每个词的权重（使用次数少的权重高）
        const maxUsage = Math.max(...Array.from(stats.values()), 0);
        const weightedWords = words.map(word => {
            const usage = stats.get(word) || 0;
            const weight = maxUsage - usage + 1;
            return { word, weight };
        });
        
        // 按权重随机选择
        const totalWeight = weightedWords.reduce((sum, item) => sum + item.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const item of weightedWords) {
            random -= item.weight;
            if (random <= 0) {
                return item.word;
            }
        }
        
        return words[0]; // 兜底返回
    }
    
    updateUsageStats(dimensionName, word) {
        if (!this.usageStats.has(dimensionName)) {
            this.usageStats.set(dimensionName, new Map());
        }
        
        const stats = this.usageStats.get(dimensionName);
        stats.set(word, (stats.get(word) || 0) + 1);
    }
    
    resetStats() {
        this.usageStats.clear();
    }
    
    getStats() {
        const result = {};
        for (const [dimName, stats] of this.usageStats) {
            result[dimName] = Object.fromEntries(stats);
        }
        return result;
    }
}

/**
 * 词汇过滤器
 */
class WordFilter {
    constructor(name, filterFn) {
        this.name = name;
        this.filterFn = filterFn;
        this.enabled = true;
    }
    
    apply(words) {
        if (!this.enabled) return words;
        return words.filter(this.filterFn);
    }
    
    enable() {
        this.enabled = true;
    }
    
    disable() {
        this.enabled = false;
    }
}

/**
 * 生成历史管理器
 */
class GenerationHistoryManager {
    constructor(maxSize = 1000) {
        this.history = [];
        this.maxSize = maxSize;
        this.favorites = new Set();
    }
    
    addGeneration(generation) {
        const entry = {
            id: this.generateId(),
            ...generation,
            timestamp: Date.now(),
            isFavorite: false
        };
        
        this.history.unshift(entry);
        
        // 限制历史记录大小
        if (this.history.length > this.maxSize) {
            const removed = this.history.splice(this.maxSize);
            // 保留收藏的记录
            removed.forEach(item => {
                if (this.favorites.has(item.id)) {
                    this.history.push(item);
                }
            });
        }
        
        return entry.id;
    }
    
    getHistory(limit = 50) {
        return this.history.slice(0, limit);
    }
    
    getById(id) {
        return this.history.find(item => item.id === id);
    }
    
    addToFavorites(id) {
        const item = this.getById(id);
        if (item) {
            item.isFavorite = true;
            this.favorites.add(id);
            return true;
        }
        return false;
    }
    
    removeFromFavorites(id) {
        const item = this.getById(id);
        if (item) {
            item.isFavorite = false;
            this.favorites.delete(id);
            return true;
        }
        return false;
    }
    
    getFavorites() {
        return this.history.filter(item => item.isFavorite);
    }
    
    search(query) {
        const lowerQuery = query.toLowerCase();
        return this.history.filter(item => {
            // 搜索词汇组合
            const wordsText = Object.values(item.words || {}).join(' ').toLowerCase();
            if (wordsText.includes(lowerQuery)) return true;
            
            // 搜索AI生成的内容
            if (item.aiResponse && item.aiResponse.toLowerCase().includes(lowerQuery)) return true;
            
            return false;
        });
    }
    
    clear() {
        this.history = [];
        this.favorites.clear();
    }
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    exportHistory() {
        return {
            history: this.history,
            favorites: Array.from(this.favorites)
        };
    }
    
    importHistory(data) {
        if (data.history) {
            this.history = data.history;
        }
        if (data.favorites) {
            this.favorites = new Set(data.favorites);
        }
    }
}

/**
 * 词汇生成器主类
 */
class WordGenerator {
    constructor(eventBus = null, state = null) {
        this.eventBus = eventBus;
        this.state = state;
        this.dimensions = new Map();
        this.extensions = new Map();
        this.strategies = new Map();
        this.filters = new Map();
        this.currentStrategy = 'random';
        this.historyManager = new GenerationHistoryManager();
        this.isInitialized = false;
        
        // 注册默认策略
        this.registerStrategy('random', RandomStrategy);
        this.registerStrategy('balanced', BalancedStrategy);
        
        // 注册默认过滤器
        this.registerFilter('length', new WordFilter('length', word => word.length >= 2));
        this.registerFilter('chinese', new WordFilter('chinese', word => /[\u4e00-\u9fa5]/.test(word)));
        
        // 绑定事件
        this.bindEvents();
    }
    
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            // 加载默认词库
            await this.loadDefaultWordbank();
            
            // 加载扩展
            await this.loadExtensions();
            
            // 加载历史记录
            await this.loadHistory();
            
            // 加载配置
            await this.loadConfiguration();
            
            this.isInitialized = true;
            console.info('Word Generator initialized successfully');
            
            if (this.eventBus) {
                this.eventBus.emit('wordGenerator:initialized');
            }
            
        } catch (error) {
            console.error('Word Generator initialization failed:', error);
            throw error;
        }
    }
    
    async loadDefaultWordbank() {
        // 默认词库数据
        const defaultDimensions = {
            mechanisms: [
                '收集', '建造', '战斗', '探索', '解谜', '生存', '竞速', '策略', '模拟', '社交',
                '角色扮演', '卡牌', '塔防', '跳跃', '射击', '潜行', '管理', '养成', '合成', '交易',
                '挖掘', '农场', '钓鱼', '烹饪', '制作', '升级', '技能树', '装备', '宠物', '团队',
                '竞技', '回合制', '实时', '放置', '点击', '滑动', '拖拽', '匹配', '消除', '填充',
                '连线', '排列', '组合', '分解', '转换', '传送', '时间', '空间', '重力', '物理',
                '化学', '生物', '数学', '逻辑', '记忆', '反应', '节奏', '音乐', '绘画'
            ],
            
            tone: [
                '可爱', '恐怖', '神秘', '搞笑', '温馨', '冒险', '浪漫', '悲伤', '激动', '平静',
                '紧张', '轻松', '严肃', '幽默', '梦幻', '现实', '未来', '复古', '简约', '华丽',
                '黑暗', '明亮', '温暖', '冰冷', '狂野', '优雅', '粗糙', '精致', '古典', '现代',
                '东方', '西方', '科幻', '奇幻', '历史', '当代', '乡村', '都市', '自然', '人工',
                '有机', '机械', '柔软', '坚硬', '流动', '静止', '快速'
            ],
            
            characters: [
                '勇者', '法师', '战士', '盗贼', '牧师', '射手', '刺客', '骑士', '野蛮人', '德鲁伊',
                '机器人', '外星人', '动物', '精灵', '矮人', '巨人', '龙', '天使', '恶魔', '幽灵',
                '公主', '王子', '国王', '女王', '商人', '农民', '工匠', '学者', '艺术家', '医生',
                '老师', '学生', '警察', '消防员', '宇航员', '探险家', '海盗', '忍者', '武士', '超级英雄',
                '魔法师', '炼金术师', '召唤师', '驯兽师', '吟游诗人', '铁匠', '厨师', '园丁', '渔夫', '猎人',
                '小孩', '老人'
            ],
            
            scenes: [
                '森林', '沙漠', '雪山', '海洋', '洞穴', '城堡', '村庄', '城市', '太空', '地下',
                '天空', '云端', '火山', '冰川', '沼泽', '草原', '丛林', '峡谷', '河流', '湖泊',
                '学校', '医院', '商店', '餐厅', '博物馆', '图书馆', '公园', '游乐场', '体育场', '剧院',
                '工厂', '农场', '矿山', '港口', '机场', '车站', '监狱', '军营', '实验室', '办公室',
                '家', '花园', '阳台', '地下室', '阁楼', '废墟', '神庙', '教堂'
            ],
            
            items: [
                '剑', '盾', '弓', '法杖', '药水', '卷轴', '宝石', '钥匙', '地图', '指南针',
                '望远镜', '绳索', '炸弹', '陷阱', '食物', '水', '帐篷', '睡袋', '火把', '灯笼',
                '书籍', '日记', '信件', '照片', '硬币', '珠宝', '王冠', '戒指', '项链', '手镯',
                '工具', '锤子', '钳子', '扳手', '螺丝刀', '钉子', '木材', '石头', '金属', '布料',
                '种子', '花朵', '果实', '蘑菇', '草药'
            ],
            
            goals: [
                '拯救世界', '寻找宝藏', '打败boss', '收集物品', '解开谜题', '建造家园', '保护朋友', '复仇',
                '探索世界', '学习技能', '变得更强', '找到真相', '完成任务', '帮助他人', '获得荣誉', '创造历史',
                '发现秘密', '治愈疾病', '恢复和平', '重建家园', '寻找家人', '实现梦想', '克服恐惧', '获得自由',
                '证明自己', '超越极限', '维护正义', '守护传统', '开创未来', '连接世界', '理解真理', '获得智慧',
                '体验人生', '享受旅程', '创造回忆', '建立友谊', '寻找爱情', '获得认可'
            ],
            
            limitations: [
                '时间限制', '生命值', '魔法值', '体力值', '金钱不足', '装备损坏', '技能冷却', '移动受限',
                '视野受限', '记忆丢失', '无法说话', '无法听见', '无法触碰', '恐惧症', '诅咒', '疾病',
                '年龄限制', '身高限制', '重量限制', '数量限制', '材料稀缺', '工具缺失', '知识不足', '经验不足',
                '权限不够', '身份限制', '法律约束', '道德约束', '物理定律', '重力', '摩擦力', '天气',
                '季节', '昼夜', '潮汐', '地形', '环境', '污染', '辐射', '温度', '湿度', '压力',
                '氧气', '食物', '水源', '住所', '交通', '通讯', '能源'
            ],
            
            experiences: [
                '紧张刺激', '轻松愉快', '温馨感动', '惊险刺激', '神秘探索', '成就感', '挫败感', '孤独感',
                '团结协作', '竞争激烈', '学习成长', '创造发明', '艺术欣赏', '冒险探险', '浪漫甜蜜', '友谊深厚',
                '家庭温暖', '社交互动', '独处思考', '挑战极限', '突破自我', '帮助他人', '被人帮助', '领导团队',
                '跟随指引', '做出选择', '承担责任', '面对恐惧', '克服困难', '庆祝胜利', '反思失败', '珍惜当下',
                '怀念过去', '憧憬未来', '感恩生活', '欣赏美景', '品味美食', '聆听音乐', '观看表演', '参与创作',
                '分享快乐', '分担痛苦', '共同奋斗'
            ]
        };
        
        // 加载到dimensions中
        for (const [dimName, words] of Object.entries(defaultDimensions)) {
            this.addDimension(dimName, words);
        }
    }
    
    addDimension(name, words) {
        if (!Array.isArray(words)) {
            throw new Error(`Dimension '${name}' words must be an array`);
        }
        
        this.dimensions.set(name, [...words]);
        
        if (this.eventBus) {
            this.eventBus.emit('wordGenerator:dimension-added', { 
                name, 
                wordCount: words.length 
            });
        }
    }
    
    removeDimension(name) {
        const success = this.dimensions.delete(name);
        
        if (success && this.eventBus) {
            this.eventBus.emit('wordGenerator:dimension-removed', { name });
        }
        
        return success;
    }
    
    updateDimension(name, words) {
        if (!this.dimensions.has(name)) {
            throw new Error(`Dimension '${name}' not found`);
        }
        
        this.addDimension(name, words);
    }
    
    getDimensions() {
        const result = {};
        for (const [name, words] of this.dimensions) {
            result[name] = [...words];
        }
        return result;
    }
    
    getDimensionNames() {
        return Array.from(this.dimensions.keys());
    }
    
    getWordCount(dimensionName = null) {
        if (dimensionName) {
            const words = this.dimensions.get(dimensionName);
            return words ? words.length : 0;
        }
        
        return Array.from(this.dimensions.values())
            .reduce((total, words) => total + words.length, 0);
    }
    
    registerStrategy(name, StrategyClass) {
        this.strategies.set(name, StrategyClass);
    }
    
    setStrategy(name) {
        if (!this.strategies.has(name)) {
            throw new Error(`Strategy '${name}' not found`);
        }
        
        this.currentStrategy = name;
        
        if (this.eventBus) {
            this.eventBus.emit('wordGenerator:strategy-changed', { strategy: name });
        }
    }
    
    registerFilter(name, filter) {
        this.filters.set(name, filter);
    }
    
    enableFilter(name) {
        const filter = this.filters.get(name);
        if (filter) {
            filter.enable();
        }
    }
    
    disableFilter(name) {
        const filter = this.filters.get(name);
        if (filter) {
            filter.disable();
        }
    }
    
    generateWords(selectedDimensions = [], count = 1, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Word Generator not initialized');
        }
        
        if (selectedDimensions.length === 0) {
            selectedDimensions = this.getDimensionNames();
        }
        
        // 构建生成用的dimensions数据
        const generationDimensions = {};
        for (const dimName of selectedDimensions) {
            if (!this.dimensions.has(dimName)) {
                console.warn(`Dimension '${dimName}' not found, skipping`);
                continue;
            }
            
            let words = this.dimensions.get(dimName);
            
            // 应用过滤器
            for (const filter of this.filters.values()) {
                words = filter.apply(words);
            }
            
            if (words.length > 0) {
                generationDimensions[dimName] = words;
            }
        }
        
        if (Object.keys(generationDimensions).length === 0) {
            throw new Error('No valid dimensions available for generation');
        }
        
        // 获取生成策略
        const StrategyClass = this.strategies.get(this.currentStrategy);
        const strategy = new StrategyClass();
        
        // 生成词汇组合
        const results = strategy.generate(generationDimensions, count, options);
        
        // 记录到历史
        const generationEntry = {
            strategy: this.currentStrategy,
            dimensions: selectedDimensions,
            count,
            options,
            results
        };
        
        const historyId = this.historyManager.addGeneration(generationEntry);
        
        if (this.eventBus) {
            this.eventBus.emit('wordGenerator:words-generated', {
                historyId,
                results,
                dimensions: selectedDimensions,
                count
            });
        }
        
        return {
            historyId,
            results,
            metadata: {
                strategy: this.currentStrategy,
                dimensions: selectedDimensions,
                timestamp: Date.now()
            }
        };
    }
    
    combineWords(words, strategy = 'simple') {
        if (!words || typeof words !== 'object') {
            return '';
        }
        
        const wordArray = Object.values(words).filter(Boolean);
        
        switch (strategy) {
            case 'simple':
                return wordArray.join(' + ');
            
            case 'sentence':
                return `在${words.scenes || '某个地方'}，${words.characters || '某个角色'}使用${words.mechanisms || '某种机制'}${words.items ? ('和' + words.items) : ''}来${words.goals || '达成目标'}。`;
            
            case 'description':
                const parts = [];
                if (words.tone) parts.push(`${words.tone}的`);
                if (words.characters) parts.push(`${words.characters}`);
                if (words.scenes) parts.push(`在${words.scenes}中`);
                if (words.mechanisms) parts.push(`通过${words.mechanisms}`);
                if (words.goals) parts.push(`来${words.goals}`);
                if (words.experiences) parts.push(`，体验${words.experiences}`);
                return parts.join('');
            
            default:
                return wordArray.join(' ');
        }
    }
    
    addExtension(extension) {
        const validation = extension.validate();
        if (!validation.valid) {
            throw new Error(`Extension validation failed: ${validation.errors.join(', ')}`);
        }
        
        this.extensions.set(extension.name, extension);
        
        // 合并维度数据
        for (const [dimName, words] of Object.entries(extension.dimensions)) {
            if (this.dimensions.has(dimName)) {
                // 合并到现有维度
                const existingWords = this.dimensions.get(dimName);
                const mergedWords = [...new Set([...existingWords, ...words])];
                this.dimensions.set(dimName, mergedWords);
            } else {
                // 创建新维度
                this.dimensions.set(dimName, [...words]);
            }
        }
        
        if (this.eventBus) {
            this.eventBus.emit('wordGenerator:extension-added', {
                name: extension.name,
                dimensions: extension.getDimensionNames(),
                wordCount: extension.getWordCount()
            });
        }
    }
    
    removeExtension(name) {
        const extension = this.extensions.get(name);
        if (!extension) return false;
        
        this.extensions.delete(name);
        
        // 重新构建词库（移除扩展的词汇）
        this.rebuildWordbank();
        
        if (this.eventBus) {
            this.eventBus.emit('wordGenerator:extension-removed', { name });
        }
        
        return true;
    }
    
    rebuildWordbank() {
        // 清空当前词库
        this.dimensions.clear();
        
        // 重新加载默认词库
        this.loadDefaultWordbank();
        
        // 重新加载所有扩展
        for (const extension of this.extensions.values()) {
            for (const [dimName, words] of Object.entries(extension.dimensions)) {
                if (this.dimensions.has(dimName)) {
                    const existingWords = this.dimensions.get(dimName);
                    const mergedWords = [...new Set([...existingWords, ...words])];
                    this.dimensions.set(dimName, mergedWords);
                } else {
                    this.dimensions.set(dimName, [...words]);
                }
            }
        }
    }
    
    getExtensions() {
        return Array.from(this.extensions.values());
    }
    
    exportWordbank() {
        return {
            version: '1.0.0',
            timestamp: Date.now(),
            dimensions: this.getDimensions(),
            extensions: this.getExtensions().map(ext => ({
                name: ext.name,
                version: ext.version,
                author: ext.author,
                description: ext.description,
                dimensions: ext.dimensions,
                metadata: ext.metadata
            }))
        };
    }
    
    importWordbank(data) {
        try {
            if (data.dimensions) {
                for (const [dimName, words] of Object.entries(data.dimensions)) {
                    this.addDimension(dimName, words);
                }
            }
            
            if (data.extensions) {
                for (const extData of data.extensions) {
                    const extension = new WordbankExtension(extData.name, extData);
                    this.addExtension(extension);
                }
            }
            
            this.saveWordbank();
            
            if (this.eventBus) {
                this.eventBus.emit('wordGenerator:wordbank-imported', {
                    dimensionCount: Object.keys(data.dimensions || {}).length,
                    extensionCount: (data.extensions || []).length
                });
            }
            
            return true;
        } catch (error) {
            console.error('Wordbank import failed:', error);
            return false;
        }
    }
    
    getHistory(limit = 50) {
        return this.historyManager.getHistory(limit);
    }
    
    searchHistory(query) {
        return this.historyManager.search(query);
    }
    
    addToFavorites(historyId) {
        return this.historyManager.addToFavorites(historyId);
    }
    
    removeFromFavorites(historyId) {
        return this.historyManager.removeFromFavorites(historyId);
    }
    
    getFavorites() {
        return this.historyManager.getFavorites();
    }
    
    clearHistory() {
        this.historyManager.clear();
        this.saveHistory();
        
        if (this.eventBus) {
            this.eventBus.emit('wordGenerator:history-cleared');
        }
    }
    
    bindEvents() {
        if (!this.eventBus) return;
        
        // 监听状态变化
        this.eventBus.on('state:changed', (data) => {
            if (data.path.startsWith('generator.')) {
                this.saveConfiguration();
            }
        });
        
        // 监听应用退出
        this.eventBus.on('app:beforeunload', () => {
            this.saveWordbank();
            this.saveHistory();
        });
    }
    
    async loadExtensions() {
        if (!window.StorageManager) return;
        
        const extensions = window.StorageManager.get('word-extensions', []);
        
        for (const extData of extensions) {
            try {
                const extension = new WordbankExtension(extData.name, extData);
                this.addExtension(extension);
            } catch (error) {
                console.warn(`Failed to load extension '${extData.name}':`, error);
            }
        }
    }
    
    async loadHistory() {
        if (!window.StorageManager) return;
        
        const historyData = window.StorageManager.get('word-history', null);
        if (historyData) {
            this.historyManager.importHistory(historyData);
        }
    }
    
    async loadConfiguration() {
        if (!window.StorageManager) return;
        
        const config = window.StorageManager.get('word-config', {});
        
        if (config.strategy) {
            try {
                this.setStrategy(config.strategy);
            } catch (error) {
                console.warn('Failed to restore word generation strategy:', error);
            }
        }
        
        if (config.filters) {
            for (const [name, enabled] of Object.entries(config.filters)) {
                if (enabled) {
                    this.enableFilter(name);
                } else {
                    this.disableFilter(name);
                }
            }
        }
    }
    
    saveWordbank() {
        if (!window.StorageManager) return;
        
        const wordbank = this.exportWordbank();
        window.StorageManager.set('word-wordbank', wordbank);
        
        const extensions = this.getExtensions();
        window.StorageManager.set('word-extensions', extensions);
    }
    
    saveHistory() {
        if (!window.StorageManager) return;
        
        const historyData = this.historyManager.exportHistory();
        window.StorageManager.set('word-history', historyData);
    }
    
    saveConfiguration() {
        if (!window.StorageManager) return;
        
        const config = {
            strategy: this.currentStrategy,
            filters: {}
        };
        
        for (const [name, filter] of this.filters) {
            config.filters[name] = filter.enabled;
        }
        
        window.StorageManager.set('word-config', config);
    }
    
    exportData() {
        return {
            wordbank: this.exportWordbank(),
            history: this.historyManager.exportHistory(),
            configuration: {
                strategy: this.currentStrategy,
                filters: Object.fromEntries(
                    Array.from(this.filters.entries()).map(([name, filter]) => [name, filter.enabled])
                )
            }
        };
    }
    
    importData(data) {
        try {
            if (data.wordbank) {
                this.importWordbank(data.wordbank);
            }
            
            if (data.history) {
                this.historyManager.importHistory(data.history);
            }
            
            if (data.configuration) {
                if (data.configuration.strategy) {
                    this.setStrategy(data.configuration.strategy);
                }
                
                if (data.configuration.filters) {
                    for (const [name, enabled] of Object.entries(data.configuration.filters)) {
                        if (enabled) {
                            this.enableFilter(name);
                        } else {
                            this.disableFilter(name);
                        }
                    }
                }
            }
            
            this.saveWordbank();
            this.saveHistory();
            this.saveConfiguration();
            
            return true;
        } catch (error) {
            console.error('Word generator data import failed:', error);
            return false;
        }
    }
    
    getStats() {
        return {
            dimensionCount: this.dimensions.size,
            totalWords: this.getWordCount(),
            extensionCount: this.extensions.size,
            historyCount: this.historyManager.history.length,
            favoriteCount: this.historyManager.favorites.size,
            currentStrategy: this.currentStrategy,
            availableStrategies: Array.from(this.strategies.keys()),
            activeFilters: Array.from(this.filters.entries())
                .filter(([name, filter]) => filter.enabled)
                .map(([name]) => name)
        };
    }
}

// 导出类供其他模块使用
window.WordGenerator = WordGenerator;
window.WordbankExtension = WordbankExtension;
window.GenerationStrategy = GenerationStrategy;
window.RandomStrategy = RandomStrategy;
window.BalancedStrategy = BalancedStrategy;
window.WordFilter = WordFilter; 