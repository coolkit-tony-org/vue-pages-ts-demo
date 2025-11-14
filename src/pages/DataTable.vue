<script setup lang="ts">
import { ref, computed, onMounted, toRaw, watch, h } from 'vue'
import type { CSSProperties } from 'vue'
import { useDebounceFn, useVirtualList } from '@vueuse/core'
import { Table, Input, Button, Space, Popover, Switch, Spin, Tag, Checkbox } from 'ant-design-vue'

import type { ColumnsType, ColumnType } from 'ant-design-vue/es/table'
import type { FilterDropdownProps, FilterValue } from 'ant-design-vue/es/table/interface'
import type { FlatRow } from '../types/data'
import type { EnumFilters, EnumOptionMap } from '../workers/worker'
import { baseColumns, filterColumnsByGroup, sumColumnWidth, type GroupKey } from '../table/columns'
import { loadData, fetchDistinct, queryRows } from '../services/dataClient'

const ROW_HEIGHT = 48
const TABLE_HEIGHT = '85vh'
// 筛选项的显示数量限制，每次显示更多也依照该增量展开，保持体验一致
const MAX_FILTER_OPTIONS = 80

// 表头模块开关（大分组显隐），与列定义中的 groupKey 对应
const groupOptions: Array<{ key: GroupKey; title: string }> = [
    { key: 'ewlink', title: '易微联云' },
    { key: 'matter', title: 'Matter Bridge' },
    { key: 'homeAssistant', title: 'Home Assistant' },
]

const rows = ref<FlatRow[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)
const searchText = ref('')

// 枚举筛选的默认空值；每次重置或 worker 返回 filters 时使用
const createDefaultEnums = (): EnumFilters => ({
    deviceModel: [],
    deviceType: [],
    brand: [],
    category: [],
    ewlinkSupported: [],
    ewlinkCapabilities: [],
    matterSupported: [],
    matterDeviceType: [],
    matterProtocolVersion: [],
    matterSupportedClusters: [],
    homeAssistantSupported: [],
    homeAssistantEntities: [],
})

const enums = ref<EnumFilters>(createDefaultEnums())
const enumOptions = ref<EnumOptionMap>({
    deviceModel: [],
    deviceType: [],
    brand: [],
    category: [],
    ewlinkSupported: [],
    ewlinkCapabilities: [],
    matterSupported: [],
    matterDeviceType: [],
    matterProtocolVersion: [],
    matterSupportedClusters: [],
    homeAssistantSupported: [],
    homeAssistantEntities: [],
})


/** 三个组别的可视值 */
const groupVisibility = ref<Record<GroupKey, boolean>>({
    ewlink: true,
    matter: true,
    homeAssistant: true,
})

/**  */
const enumFilterSearch = ref<Partial<Record<keyof EnumFilters, string>>>({})
// 各列当前展开的筛选项数量；用于“显示更多”
const enumFilterLimit = ref<Partial<Record<keyof EnumFilters, number>>>({})

const getEnumFilterLimit = (key: keyof EnumFilters) => enumFilterLimit.value[key] ?? MAX_FILTER_OPTIONS
const setEnumFilterLimit = (key: keyof EnumFilters, value: number) => {
    enumFilterLimit.value = { ...enumFilterLimit.value, [key]: value }
}
const resetEnumFilterLimit = (key: keyof EnumFilters) => setEnumFilterLimit(key, MAX_FILTER_OPTIONS)
const increaseEnumFilterLimit = (key: keyof EnumFilters) =>
    setEnumFilterLimit(key, getEnumFilterLimit(key) + MAX_FILTER_OPTIONS)

/** 根据模块开关过滤列分组，再在末端附加筛选设置 */
const filteredColumns = computed(() => filterColumnsByGroup(baseColumns, groupVisibility.value))
const tableColumns = computed(() => enhanceColumns(filteredColumns.value))
const tableWidth = computed(() => `${sumColumnWidth(filteredColumns.value)}px`)
const rowKey = (row: FlatRow) => row.rowId

// 表格体用虚拟列表包裹 antd Table，保持所有内置交互（筛选、合并单元格）仍可工作
const { list: virtualList, containerProps, wrapperProps, scrollTo } = useVirtualList(rows, {
    itemHeight: ROW_HEIGHT,
    overscan: 12,
})
const visibleRows = computed(() => virtualList.value.map(item => item.data))

const phantomStyle = computed<CSSProperties>(() => ({
    height: wrapperProps.value.style.height ?? '0px',
}))

// virtual list 内部沿用 antd table，自行控制 translate 以模拟大列表
const translateStyle = computed<CSSProperties>(() => {
    const style = wrapperProps.value.style as Record<string, string>
    if ('marginTop' in style) {
        return {
            transform: `translateY(${style.marginTop ?? '0px'})`,
            minWidth: tableWidth.value,
        }
    }
    return {
        transform: `translateX(${style.marginLeft ?? '0px'})`,
        minWidth: tableWidth.value,
    }
})

const bodyScrollRef = ref<HTMLElement | null>(null)
// antd Table 内部会创建 div，需把虚拟列表容器与其 DOM 绑定
watch(bodyScrollRef, el => {
    if ('value' in containerProps.ref) containerProps.ref.value = el
})

// 顶部“fake header”同步横向滚动，避免两个滚动条
const horizontalOffset = ref(0)
const handleBodyScroll = (event: Event) => {
    containerProps.onScroll()
    const target = event.target as HTMLElement
    horizontalOffset.value = target.scrollLeft
}

// 避免响应式代理传入 worker 造成结构化克隆失败
const cloneForWorker = <T,>(value: T): T => structuredClone(toRaw(value))

// 查询走 worker，支持搜索 + 筛选；debounce 在输入时触发
const runQuery = async () => {
    loading.value = true
    error.value = null
    try {
        const res = await queryRows({
            q: searchText.value,
            enums: cloneForWorker(enums.value),
        })
        rows.value = res.rows
        total.value = res.total
        scrollTo(0)
    } catch (e: any) {
        error.value = e?.message ?? String(e)
    } finally {
        loading.value = false
    }
}
const debouncedQuery = useDebounceFn(runQuery, 200)

onMounted(async () => {
    loading.value = true
    error.value = null
    try {
        await loadData()
        enumOptions.value = await fetchDistinct()
        await runQuery()
    } catch (e: any) {
        error.value = e?.message ?? String(e)
    } finally {
        loading.value = false
    }
})

function resetAll() {
    searchText.value = ''
    enums.value = createDefaultEnums()
    groupVisibility.value = { ewlink: true, matter: true, homeAssistant: true }
    enumFilterSearch.value = {}
    enumFilterLimit.value = {}
    runQuery()
}

function handleGroupVisibilityChange(group: GroupKey, checked: boolean | string | number) {
    if (typeof checked === 'string') {
        groupVisibility.value[group] = checked === 'true'
    } else if (typeof checked === 'number') {
        groupVisibility.value[group] = checked === 1
    } else {
        groupVisibility.value[group] = checked
    }
}

watch(rows, () => {
    // 每次数据发生变化都滚动到最顶
    scrollTo(0)
})

const enumColumnMap: Record<string, keyof EnumFilters> = {
    deviceModel: 'deviceModel',
    deviceType: 'deviceType',
    deviceBrand: 'brand',
    deviceCategory: 'category',
    ewlinkCapabilities: 'ewlinkCapabilities',
    matterDeviceType: 'matterDeviceType',
    matterProtocolVersion: 'matterProtocolVersion',
    matterSupportedClusters: 'matterSupportedClusters',
    homeAssistantEntities: 'homeAssistantEntities',
}

const booleanColumnMap: Record<string, keyof EnumFilters> = {
    ewlinkSupported: 'ewlinkSupported',
    matterSupported: 'matterSupported',
    homeAssistantSupported: 'homeAssistantSupported',
}

// 返回下拉可见列表 + 是否仍有剩余，方便显示“显示更多”
const getDropdownOptionMeta = (enumKey: keyof EnumFilters, limit?: number) => {
    const raw = enumOptions.value[enumKey] || []
    const keyword = (enumFilterSearch.value[enumKey] || '').trim().toLowerCase()
    const filtered = keyword ? raw.filter(opt => opt.value.toLowerCase().includes(keyword)) : raw
    const effectiveLimit = limit ?? getEnumFilterLimit(enumKey)
    return {
        options: filtered.slice(0, effectiveLimit),
        total: filtered.length,
        hasMore: filtered.length > effectiveLimit,
    }
}

/** antd 列配置需要静态 filters，仅保留前 80 条用于勾选提示 */
const getColumnFilterOptions = (enumKey: keyof EnumFilters) => {
    const raw = enumOptions.value[enumKey] || []
    return raw.slice(0, MAX_FILTER_OPTIONS)
}

/** 生成下拉选项框的DOM */
const renderFilterDropdown =
    (enumKey: keyof EnumFilters) =>
        (props: FilterDropdownProps<FlatRow>) => {
            const search = enumFilterSearch.value[enumKey] || ''
            const limit = getEnumFilterLimit(enumKey)
            const { options, hasMore, total } = getDropdownOptionMeta(enumKey, limit)
            const selectedKeys = (props.selectedKeys as string[]) ?? []

            const toggleValue = (value: string, checked: boolean) => {
                const next = checked ? [...selectedKeys, value] : selectedKeys.filter(v => v !== value)
                props.setSelectedKeys?.(next)
            }

            const clear = () => {
                enumFilterSearch.value = { ...enumFilterSearch.value, [enumKey]: '' }
                resetEnumFilterLimit(enumKey)
                props.clearFilters?.()
            }

            return h(
                'div',
                { class: 'ant-dropdown ant-table-filter-dropdown custom-filter-dropdown' },
                [
                    h('div', { class: 'ant-table-filter-dropdown-search' }, [
                        h(Input, {
                            size: 'small',
                            allowClear: true,
                            placeholder: '搜索选项',
                            value: search,
                            'onUpdate:value': (val: string) => {
                                enumFilterSearch.value = { ...enumFilterSearch.value, [enumKey]: val }
                                resetEnumFilterLimit(enumKey)
                            },
                        }),
                    ]),
                    h(
                        'div',
                        {
                            class:
                                'ant-dropdown-menu ant-dropdown-menu-root ant-table-filter-dropdown-menu filter-menu',
                        },
                        options.length
                            ? options.map(opt =>
                                h(
                                    'label',
                                    {
                                        key: opt.value,
                                        class: 'ant-dropdown-menu-item filter-menu-item',
                                    },
                                    [
                                        h(Checkbox, {
                                            checked: selectedKeys.includes(opt.value),
                                            onChange: (e: any) => toggleValue(opt.value, e.target.checked),
                                        }),
                                        h(
                                            'span',
                                            { class: 'filter-menu-text' },
                                            `${formatFilterLabel(enumKey, opt.value)} (${opt.count})`
                                        ),
                                    ]
                                )
                            )
                            : h('div', { class: 'filter-empty' }, '无匹配项')
                    ),
                    hasMore
                        ? h(
                            'div',
                            { class: 'filter-more' },
                            h(
                                Button,
                                {
                                    type: 'link',
                                    size: 'small',
                                    onClick: () => increaseEnumFilterLimit(enumKey),
                                },
                                () => `显示更多 (${Math.min(limit, total)}/${total})`
                            )
                        )
                        : null,
                    h('div', { class: 'ant-table-filter-dropdown-btns' }, [
                        h(
                            Button,
                            {
                                size: 'small',
                                type: 'link',
                                onClick: clear,
                            },
                            () => '清除'
                        ),
                        h(
                            Button,
                            {
                                type: 'primary',
                                size: 'small',
                                onClick: () => props.confirm?.(),
                            },
                            () => '确定'
                        ),
                    ]),
                ]
            )
        }

/** 在列定义上再注入 antd 筛选能力、筛选项以及相关配置 */
const enhanceColumns = (cols: ColumnsType<FlatRow>): ColumnsType<FlatRow> => {
    return cols.map(col => {
        // 存在叶子筛选项就继续递归（比如易微联的叶子筛选项是云支持+设备能力）
        if ('children' in col && col.children) {
            return { ...col, children: enhanceColumns(col.children) }
        }
        const leaf = col as ColumnType<FlatRow>
        const key = leaf.key as string | undefined
        if (!key) {
            throw new Error('每个需要筛选的列都必须提供唯一 key')
        }
        const enumKey = enumColumnMap[key] || booleanColumnMap[key]
        if (!enumKey) return leaf
        const opts = getColumnFilterOptions(enumKey)
        const filters = opts.map(option => ({
            text: `${formatFilterLabel(enumKey, option.value)} (${option.count})`,
            value: option.value,
        }))
        const selected = enums.value[enumKey]
        return {
            ...leaf,
            filters,
            filterMultiple: true,
            filteredValue: selected && selected.length ? selected.map(value => String(value)) : null,
            filterDropdown: renderFilterDropdown(enumKey),
        }
    })
}

const formatFilterLabel = (key: keyof EnumFilters, value: string) => {
    if (key === 'ewlinkSupported' || key === 'matterSupported' || key === 'homeAssistantSupported') {
        return value === 'true' ? '是' : '否'
    }
    return value || '—'
}

// antd change 事件只告诉我们列 key -> 选中的值，需要映射回 worker 的 enums 结构
function applyEnumFiltersFromTable(filters: Record<string, FilterValue | null | undefined>) {
    console.log('applyEnumFiltersFromTable filter -> ', filters);
    const next = createDefaultEnums()
    let changed = false
    const assignValues = (filterKey: keyof EnumFilters, values: (string | number | boolean)[] | null | undefined) => {
        if (!values || values.length === 0) return
        if (filterKey === 'ewlinkSupported' || filterKey === 'matterSupported' || filterKey === 'homeAssistantSupported') {
            next[filterKey] = values.map(val => (String(val) === 'true')) as any
        } else {
            next[filterKey] = values.map(val => String(val))
        }
    }
    Object.entries(filters).forEach(([columnKey, value]) => {
        const enumKey = enumColumnMap[columnKey] || booleanColumnMap[columnKey]
        if (!enumKey) return
        assignValues(enumKey, value || undefined)
    })
    if (JSON.stringify(next) !== JSON.stringify(enums.value)) {
        enums.value = next
        changed = true
    }
    return changed
}

const handleTableChange = (_pagination: unknown, filters: Record<string, FilterValue | null>) => {
    const changed = applyEnumFiltersFromTable(filters)
    if (changed) runQuery()
}
</script>

<template>
    <section class="page-section">
        <div class="toolbar">
            <Space class="toolbar-controls">
                <Input v-model:value="searchText" placeholder="搜索：型号 / 品牌 / 类别 / 能力" style="width: 360px" allow-clear
                    @input="debouncedQuery()" />
                <Popover trigger="click" placement="bottomLeft">
                    <template #content>
                        <div class="column-popover">
                            <div class="column-popover-title">模块显隐</div>
                            <div v-for="option in groupOptions" :key="option.key" class="column-toggle-row">
                                <span>{{ option.title }}</span>
                                <Switch :checked="groupVisibility[option.key]"
                                    @change="(checked: boolean | string | number) => handleGroupVisibilityChange(option.key, checked)" />
                            </div>
                        </div>
                    </template>
                    <Button>模块显示</Button>
                </Popover>
                <Button @click="resetAll">重置</Button>
            </Space>

            <div class="toolbar-stats">
                <span class="status-pill">
                    <span class="status-dot" />
                    <span class="status-count">共 {{ total }} 条</span>
                </span>
                <span v-if="loading" class="status-hint">（加载中…）</span>
                <span v-if="error">
                    <Tag color="error">请求失败：{{ error }}</Tag>
                    <Button size="small" @click="runQuery">重试</Button>
                </span>
            </div>
        </div>

        <div class="data-table-shell">
            <div class="data-table-header">
                <div class="header-inner" :style="{ transform: `translateX(-${horizontalOffset}px)` }">
                    <Table class="data-table" size="small" bordered :columns="tableColumns" :dataSource="[]"
                        :pagination="false" :rowKey="rowKey" :style="{ minWidth: tableWidth }"
                        @change="handleTableChange" />
                </div>
            </div>
            <div class="data-table-body" :style="[containerProps.style, { height: TABLE_HEIGHT }]" ref="bodyScrollRef"
                @scroll="handleBodyScroll">
                <template v-if="!loading && rows.length === 0">
                    <div class="empty-placeholder">暂无数据</div>
                </template>
                <template v-else>
                    <div class="virtual-phantom" :style="phantomStyle">
                        <div class="virtual-inner" :style="translateStyle">
                            <Table class="data-table" :columns="tableColumns" :dataSource="visibleRows"
                                :pagination="false" :rowKey="rowKey" size="small" bordered :showHeader="false"
                                :style="{ minWidth: tableWidth }" />
                        </div>
                    </div>
                </template>
            </div>
            <div v-if="loading" class="tbl-loading">
                <Spin />
            </div>
        </div>
    </section>
</template>

<style scoped>
.page-section {
    padding: 12px 20px 20px;
    min-height: 100vh;
    background: radial-gradient(circle at top, #f8fafc, #eef2f7 60%, #e5e9f0);
    transition: background 0.4s ease;
}

.toolbar {
    width: 100%;
    margin-bottom: 20px;
    padding: 14px 18px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
    animation: float-in 0.4s ease;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
}

.toolbar-controls {
    flex: 1;
    align-items: center;
}

.toolbar :deep(.ant-select),
.toolbar :deep(.ant-input) {
    transition: box-shadow 0.3s ease;
}

.toolbar :deep(.ant-select-focused),
.toolbar :deep(.ant-input-focused) {
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.data-table-shell {
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.95);
    overflow: hidden;
    box-shadow: 0 15px 45px rgba(15, 23, 42, 0.12);
    animation: fade-up 0.5s ease;
}

.data-table-header {
    overflow: hidden;
    border-bottom: 1px solid #e5e7eb;
    background: linear-gradient(90deg, #f6f8fb, #eef2f7);
}

.header-inner {
    will-change: transform;
    transition: transform 0.2s ease-out;
}

.data-table-header :deep(.ant-table-tbody) {
    display: none;
}

.data-table-body {
    position: relative;
    overflow: auto;
    background: #fff;
}

.data-table :deep(.ant-table-cell) {
    white-space: nowrap;
    transition: background 0.2s ease;
}

.data-table :deep(.ant-table-tbody > tr:hover > td) {
    background: #f5f7fb;
}

.data-table :deep(.ant-table-tbody > tr) {
    animation: row-fade 0.35s ease both;
}

.virtual-phantom {
    width: 100%;
    position: relative;
}

.virtual-inner {
    width: 100%;
}

.column-popover {
    width: 220px;
    max-height: 50vh;
    overflow: auto;
    padding: 8px 4px;
}

.column-popover-title {
    margin-bottom: 12px;
    font-weight: 600;
    color: #334155;
}

.column-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 4px;
    border-radius: 6px;
    transition: background 0.2s ease;
}

.column-toggle-row:hover {
    background: rgba(59, 130, 246, 0.08);
}

.custom-filter-dropdown {
    width: 260px;
    padding: 8px 12px 12px;
}

.custom-filter-dropdown :deep(.ant-table-filter-dropdown-search) {
    margin-bottom: 8px;
}

.filter-menu {
    max-height: 220px;
    overflow: auto;
    border-radius: 6px;
}

.filter-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
}

.filter-menu-text {
    flex: 1;
    color: #1f2937;
}

.filter-empty {
    text-align: center;
    color: #94a3b8;
    padding: 12px 0;
}

.filter-more {
    text-align: center;
    margin: 6px 0;
}

.toolbar-stats {
    display: flex;
    align-items: center;
    gap: 14px;
    font-size: 13px;
    color: #6b7280;
    white-space: nowrap;
}

.status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 999px;
    background: rgba(59, 130, 246, 0.12);
    color: #1d4ed8;
    font-weight: 600;
    box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.2);
    backdrop-filter: blur(4px);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.status-pill:hover {
    transform: translateY(-1px);
    box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.3), 0 6px 12px rgba(59, 130, 246, 0.2);
}

.status-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #2563eb;
    box-shadow: 0 0 10px rgba(37, 99, 235, 0.6);
    animation: pulse 1.4s ease infinite;
}

.status-count {
    letter-spacing: 0.02em;
}

.status-hint {
    color: #475569;
}

.empty-placeholder {
    padding: 24px;
    text-align: center;
    color: #6b7280;
    animation: fade-in 0.3s ease;
}

.tbl-loading {
    position: sticky;
    bottom: 8px;
    width: 100%;
    display: flex;
    justify-content: center;
    padding: 8px 0;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0), #fff);
}

@keyframes fade-up {
    from {
        opacity: 0;
        transform: translateY(20px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes float-in {
    from {
        opacity: 0;
        transform: translateY(-8px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes fade-in {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

@keyframes row-fade {
    from {
        opacity: 0;
        transform: translateY(6px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes pulse {
    0% {
        transform: scale(1);
        opacity: 1;
    }

    50% {
        transform: scale(1.4);
        opacity: 0.5;
    }

    100% {
        transform: scale(1);
        opacity: 1;
    }
}
</style>
