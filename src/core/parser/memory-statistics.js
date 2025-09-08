export class MemoryStatistics {
    constructor() {
        this.lmemGroups = [];
        this.statisticsBySettings = [];
        this.summaryCache = null;
        this.tsCounts = 0;
    }

    /**
     * 设置LMEM分组数据
     * @param {Array} lmemGroups - LmemParser解析后的分组数据
     */
    setLmemData(lmemGroups, tsCounts) {
        this.lmemGroups = lmemGroups;
        this.tsCounts = tsCounts;
        // console.log('[MemoryStatistics] 设置LMEM数据，时间步总数:', this.tsCounts);
        this.summaryCache = null; // 清除缓存
    }

    /**
     * 预计算所有配置组的内存统计
     * @returns {Object} 包含所有配置组统计和全局摘要的缓存对象
     */
    calculateAllStatistics() {
        // 如果缓存存在则直接返回
        if (this.summaryCache) {
            return this.summaryCache;
        }
        
        this.statisticsBySettings = [];
        
        if (!this.lmemGroups.length) {
            console.warn('缺少LMEM数据');
            return this._createEmptyCache();
        }

        // 为每个settings组分别计算统计
        for (const group of this.lmemGroups) {
            const groupStats = this.calculateStatisticsForGroup(group);
            this.statisticsBySettings.push(groupStats);
        }
        
        // 创建并返回缓存对象
        this.summaryCache = {
            groups: this.statisticsBySettings,
            globalSummary: this.calculateGlobalSummary()
        };
        
        return this.summaryCache;
    }

    /**
     * 为单个settings组计算统计
     * @param {Object} group - 包含settings和allocations的组
     * @returns {Object} 该组的统计信息
     */
    calculateStatisticsForGroup(group) {
        const { settings, allocations } = group;
        
        // 获取该组的最大时间步
        const maxTimestep = this.getMaxTimestepForGroup(allocations);
        const stepStatistics = [];

        // 为每个时间步计算统计
        for (let step = 0; step <= maxTimestep; step++) {
            const stepStats = this.calculateStepStatisticsForGroup(allocations, step, settings);
            stepStatistics.push(stepStats);
        }

        return {
            settings: { ...settings },
            stepStatistics,
            summary: this.calculateGroupSummary(stepStatistics, allocations)
        };
    }

    /**
     * 计算全局摘要信息
     * @returns {Object} 全局摘要
     */
    calculateGlobalSummary() {
        if (!this.statisticsBySettings.length) return {};
        
        // 计算所有配置组的峰值内存使用
        const maxMemoryUsage = Math.max(
            ...this.statisticsBySettings.map(group => 
                Math.max(...group.stepStatistics.map(step => step.usedMemory))
            )
        );
        
        // 计算所有配置组的总分配数
        const totalAllocations = this.statisticsBySettings.reduce(
            (sum, group) => sum + group.summary.totalAllocations, 0
        );
        
        // 计算所有配置组的平均成功率
        const successRates = this.statisticsBySettings.map(group => group.summary.successRate);
        const avgSuccessRate = successRates.reduce((sum, rate) => sum + rate, 0) / successRates.length;
        
        return {
            totalGroups: this.statisticsBySettings.length,
            maxMemoryUsage,
            totalAllocations,
            avgSuccessRate,
            // 可以添加更多全局指标
        };
    }

    /**
     * 获取所有组的统计结果（使用缓存）
     * @returns {Array}
     */
    getStatistics() {
        if (!this.summaryCache) this.calculateAllStatistics();
        return this.statisticsBySettings;
    }

    /**
     * 按settings键获取特定组的统计（使用缓存）
     * @param {string} settingsKey - settings的唯一标识键
     * @returns {Object|null}
     */
    getStatisticsBySettings(settingsKey) {
        if (!this.summaryCache) this.calculateAllStatistics();
        return this.statisticsBySettings.find(group => 
            this.getSettingsKey(group.settings) === settingsKey
        ) || null;
    }

    /**
     * 获取所有settings的对比摘要（使用缓存）
     * @returns {Array}
     */
    getSettingsComparison() {
        if (!this.summaryCache) this.calculateAllStatistics();
        return this.statisticsBySettings.map(group => ({
            settings: group.settings,
            settingsKey: this.getSettingsKey(group.settings),
            summary: group.summary
        }));
    }

    /**
     * 获取全局摘要（使用缓存）
     * @returns {Object}
     */
    getGlobalSummary() {
        if (!this.summaryCache) this.calculateAllStatistics();
        return this.summaryCache.globalSummary;
    }

    /**
     * 创建空缓存对象
     * @private
     */
    _createEmptyCache() {
        this.summaryCache = {
            groups: [],
            globalSummary: {}
        };
        return this.summaryCache;
    }
    /**
     * 获取单个组的最大时间步
     * @param {Array} allocations - 分配数组
     * @returns {number}
     */
    getMaxTimestepForGroup(allocations) {
        return allocations.reduce((max, alloc) => 
            Math.max(max, alloc.timestep_end || 0, alloc.max_timestep || 0), 0
        );
    }

    /**
     * 计算单个时间步的统计（针对特定settings组）
     * @param {Array} allocations - 分配数组
     * @param {number} step - 时间步
     * @param {Object} settings - 配置信息
     * @returns {Object} 时间步内存统计
     */
    calculateStepStatisticsForGroup(allocations, step, settings) {
        // 获取当前时间步的所有分配
        const stepAllocations = this.getAllocationsForTimestep(allocations, step);
        
        // 按bank分组分配
        const allocationsByBank = this.groupAllocationsByBank(stepAllocations);

        return {
            step: step,
            settingsKey: this.getSettingsKey(settings),
            totalMemory: this.calculateTotalMemory(stepAllocations),
            usedMemory: this.calculateUsedMemory(stepAllocations),
            freeMemory: this.calculateFreeMemory(stepAllocations),
            memoryUsagePercentage: this.calculateUsagePercentage(stepAllocations),
            peakMemory: this.calculatePeakMemory(stepAllocations),
            allocationCount: stepAllocations.length,
            activeAllocations: stepAllocations.length,
            bankStatistics: this.calculateBankStatistics(allocationsByBank),
            detailedStats: this.getDetailedStatistics(stepAllocations)
        };
    }

    /**
     * 生成settings的唯一标识键
     * @param {Object} settings - 配置信息
     * @returns {string}
     */
    getSettingsKey(settings) {
        return JSON.stringify({
            allow_bank_conflict: settings.allow_bank_conflict,
            shape_secs: settings.shape_secs
        });
    }

    /**
     * 获取指定时间步的所有内存分配
     * @param {Array} allocations - 分配数组
     * @param {number} step - 时间步
     * @returns {Array} 该时间步的分配数组
     */
    getAllocationsForTimestep(allocations, step) {
        return allocations.filter(alloc => 
            this.isAllocationActive(alloc, step)
        );
    }

    /**
     * 检查分配是否在指定时间步活跃
     * @param {Object} allocation - 内存分配对象
     * @param {number} step - 时间步
     * @returns {boolean}
     */
    isAllocationActive(allocation, step) {
        if(allocation.hold_in_lmem){
            return true;
        }
        else if( allocation.timestep_start <= allocation.timestep_end){
            return allocation.timestep_start <= step && 
                   allocation.timestep_end >= step;
        }
        else{
            return allocation.timestep_start <= step && this.tsCounts >= step 
                ||
                  allocation.timestep_end >= step && 0 <= step;
        }
        // return allocation.timestep_start <= step && 
        //        allocation.timestep_end >= step;
    }

    /**
     * 按bank分组分配
     * @param {Array} allocations - 分配数组
     * @returns {Object} 按bank分组的分配
     */
    groupAllocationsByBank(allocations) {
        return allocations.reduce((groups, alloc) => {
            const bankId = alloc.bank_id || 0;
            if (!groups[bankId]) {
                groups[bankId] = [];
            }
            groups[bankId].push(alloc);
            return groups;
        }, {});
    }

    /**
     * 计算bank级别的统计
     * @param {Object} allocationsByBank - 按bank分组的分配
     * @returns {Object} bank统计信息
     */
    calculateBankStatistics(allocationsByBank) {
        const bankStats = {};
        
        for (const [bankId, allocations] of Object.entries(allocationsByBank)) {
            bankStats[bankId] = {
                usedMemory: this.calculateUsedMemory(allocations),
                allocationCount: allocations.length,
                averageAllocationSize: this.calculateAverageAllocation(allocations),
                largestAllocation: this.calculateLargestAllocation(allocations)
            };
        }
        
        return bankStats;
    }

    /**
     * 计算总内存（基于最大地址）
     * @param {Array} allocations - 分配数组
     * @returns {number}
     */
    calculateTotalMemory(allocations) {
        if (allocations.length === 0) return 0;
        
        // 找到最大的结束地址
        const maxAddr = Math.max(...allocations.map(alloc => alloc.addr + alloc.size));
        return maxAddr;
    }

    /**
     * 计算已使用内存
     * @param {Array} allocations - 分配数组
     * @returns {number}
     */
    calculateUsedMemory(allocations) {
        return allocations.reduce((total, alloc) => total + alloc.size, 0);
    }

    /**
     * 计算空闲内存
     * @param {Array} allocations - 分配数组
     * @returns {number}
     */
    calculateFreeMemory(allocations) {
        const total = this.calculateTotalMemory(allocations);
        const used = this.calculateUsedMemory(allocations);
        return Math.max(0, total - used);
    }

    /**
     * 计算内存使用率
     * @param {Array} allocations - 分配数组
     * @returns {number}
     */
    calculateUsagePercentage(allocations) {
        const total = this.calculateTotalMemory(allocations);
        const used = this.calculateUsedMemory(allocations);
        return total > 0 ? (used / total) * 100 : 0;
    }

    /**
     * 计算峰值内存（当前时间步最大单分配）
     * @param {Array} allocations - 分配数组
     * @returns {number}
     */
    calculatePeakMemory(allocations) {
        return allocations.length > 0 ? 
            Math.max(...allocations.map(alloc => alloc.size)) : 0;
    }

    /**
     * 计算平均分配大小
     * @param {Array} allocations - 分配数组
     * @returns {number}
     */
    calculateAverageAllocation(allocations) {
        const used = this.calculateUsedMemory(allocations);
        return allocations.length > 0 ? used / allocations.length : 0;
    }

    /**
     * 计算最大分配大小
     * @param {Array} allocations - 分配数组
     * @returns {number}
     */
    calculateLargestAllocation(allocations) {
        return allocations.length > 0 ? 
            Math.max(...allocations.map(alloc => alloc.size)) : 0;
    }

    /**
     * 获取详细统计信息
     * @param {Array} allocations - 分配数组
     * @returns {Object}
     */
    getDetailedStatistics(allocations) {
        const successfulAllocs = allocations.filter(alloc => alloc.status === 'success');
        const failedAllocs = allocations.filter(alloc => alloc.status !== 'success');

        return {
            successfulAllocations: successfulAllocs.length,
            failedAllocations: failedAllocs.length,
            successRate: allocations.length > 0 ? 
                (successfulAllocs.length / allocations.length) * 100 : 0,
            averageAllocationSize: this.calculateAverageAllocation(allocations),
            memoryFragmentation: this.calculateFragmentation(allocations),
            allocationTypes: this.countAllocationTypes(allocations)
        };
    }

    /**
     * 计算内存碎片率
     * @param {Array} allocations - 分配数组
     * @returns {number}
     */
    calculateFragmentation(allocations) {
        if (allocations.length < 2) return 0;
        
        const sortedAllocs = [...allocations].sort((a, b) => a.addr - b.addr);
        let totalGap = 0;
        
        for (let i = 1; i < sortedAllocs.length; i++) {
            const prevEnd = sortedAllocs[i-1].addr + sortedAllocs[i-1].size;
            const gap = sortedAllocs[i].addr - prevEnd;
            totalGap += Math.max(0, gap);
        }
        
        const totalMemory = this.calculateTotalMemory(allocations);
        return totalMemory > 0 ? (totalGap / totalMemory) * 100 : 0;
    }

    /**
     * 统计分配类型
     * @param {Array} allocations - 分配数组
     * @returns {Object}
     */
    countAllocationTypes(allocations) {
        return allocations.reduce((counts, alloc) => {
            const type = alloc.lmem_type || 'unknown';
            counts[type] = (counts[type] || 0) + 1;
            return counts;
        }, {});
    }

    /**
     * 计算组的统计摘要
     * @param {Array} stepStatistics - 时间步统计数组
     * @param {Array} allocations - 分配数组
     * @returns {Object}
     */
    calculateGroupSummary(stepStatistics, allocations) {
        const successfulAllocs = allocations.filter(alloc => alloc.status === 'success');
        const failedAllocs = allocations.filter(alloc => alloc.status !== 'success');

        return {
            totalAllocations: allocations.length,
            successfulAllocations: successfulAllocs.length,
            failedAllocations: failedAllocs.length,
            successRate: allocations.length > 0 ? 
                (successfulAllocs.length / allocations.length) * 100 : 0,
            maxMemoryUsage: Math.max(...stepStatistics.map(stat => stat.usedMemory)),
            averageMemoryUsage: stepStatistics.reduce((sum, stat) => sum + stat.usedMemory, 0) / stepStatistics.length,
            peakAllocationCount: Math.max(...stepStatistics.map(stat => stat.allocationCount)),
            totalMemoryFootprint: this.calculateTotalMemory(allocations)
        };
    }

    /**
     * 获取所有组的统计结果
     * @returns {Array}
     */
    getStatistics() {
        return this.statisticsBySettings;
    }

    /**
     * 按settings键获取特定组的统计
     * @param {string} settingsKey - settings的唯一标识键
     * @returns {Object|null}
     */
    getStatisticsBySettings(settingsKey) {
        return this.statisticsBySettings.find(group => 
            this.getSettingsKey(group.settings) === settingsKey
        ) || null;
    }

    /**
     * 获取所有settings的对比摘要
     * @returns {Array}
     */
    getSettingsComparison() {
        return this.statisticsBySettings.map(group => ({
            settings: group.settings,
            settingsKey: this.getSettingsKey(group.settings),
            summary: group.summary
        }));
    }

    /**
     * 清空数据
     */
    clear() {
        this.lmemGroups = [];
        this.statisticsBySettings = [];
        this.summaryCache = null;   // 清除缓存
    }
}

export default MemoryStatistics;