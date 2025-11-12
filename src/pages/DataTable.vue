<script setup lang="ts">
import { ref, computed, onMounted, toRaw, watch, reactive, h } from 'vue'
import type { CSSProperties } from 'vue'
import { useDebounceFn, useVirtualList } from '@vueuse/core'
import { Table, Input, Select, Button, Space, Popover, Switch, Spin, Tag, InputNumber } from 'ant-design-vue'

import type { ColumnsType, ColumnType } from 'ant-design-vue/es/table'
import type { FilterDropdownProps } from 'ant-design-vue/es/table/interface'
import type { FlatRow } from '../types/data'
import type { EnumFilters, EnumOptionMap, MatchMode, RangeFilters, SortSpec } from '../workers/data.worker'
import { baseColumns, buildDefaultVisibility, filterColumnsByVisibility, leafColumns, sumColumnWidth } from '../table/columns'
import { loadData, fetchDistinct, queryRows } from '../services/dataClient'

type RangeState = {
    uiid: NonNullable<RangeFilters['uiid']>
    indexTop: NonNullable<RangeFilters['indexTop']>
}

const ROW_HEIGHT = 48
const TABLE_HEIGHT = '70vh'
let rowUid = 0
const AntButton = Button as any
const AntInputNumber = InputNumber as any

// -------------------------------
// 查询与状态
// -------------------------------
const rows = ref<FlatRow[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)

const searchText = ref('')
const matchMode = ref<MatchMode>('contains')

const createDefaultEnums = (): EnumFilters => ({
    online: [],
    model: [],
    ui: [],
    brandName: [],
    productModel: [],
    type: [],
    parentid: [],
})

const createInitialEnumOptions = (): EnumOptionMap => ({
    online: [true, false],
    model: [],
    ui: [],
    brandName: [],
    productModel: [],
    type: [],
    parentid: [],
})

const createDefaultRanges = (): RangeState => ({
    uiid: { min: undefined, max: undefined },
    indexTop: { min: undefined, max: undefined },
})

const cloneForWorker = <T,>(value: T): T => structuredClone(toRaw(value))

const enums = ref<EnumFilters>(createDefaultEnums())
const enumOptions = ref<EnumOptionMap>(createInitialEnumOptions())
const ranges = ref<RangeState>(createDefaultRanges())

const visibleCols = ref<Record<string, boolean>>(buildDefaultVisibility())

const sort = ref<SortSpec[]>([
    { id: 'itemData.online', desc: true },
    { id: 'itemData.family.index', desc: true },
    { id: 'itemData.deviceid', desc: false },
])

const antColumns = computed(() => filterColumnsByVisibility(baseColumns, visibleCols.value))
const tableWidth = computed(() => `${sumColumnWidth(antColumns.value)}px`)

const createRowId = (row: FlatRow) => `${row['itemData.deviceid'] ?? 'row'}-${rowUid++}`

const assignRowId = (row: FlatRow): FlatRow => {
    const clone = { ...row } as FlatRow & { __virtualId?: string }
    clone.__virtualId = createRowId(row)
    return clone
}

const rowKey = (row: FlatRow) => {
    const target = row as FlatRow & { __virtualId?: string }
    if (!target.__virtualId) {
        target.__virtualId = createRowId(row)
    }
    return target.__virtualId
}
const leafColumnOptions = leafColumns.map(col => {
    const dataIndex = Array.isArray(col.dataIndex) ? col.dataIndex.join('.') : col.dataIndex?.toString()
    return {
        key: (col.key || dataIndex || '') as string,
        title: (col.title as string) || (col.key as string) || '',
    }
})

// -------------------------------
// 虚拟滚动（VueUse）
// -------------------------------
const { list: virtualList, containerProps, wrapperProps, scrollTo } = useVirtualList(rows, {
    itemHeight: ROW_HEIGHT,
    overscan: 12,
})

const visibleRows = computed(() => virtualList.value.map(item => item.data))

const phantomStyle = computed<CSSProperties>(() => ({
    height: wrapperProps.value.style.height ?? '0px',
}))

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
watch(bodyScrollRef, el => {
    if ('value' in containerProps.ref) containerProps.ref.value = el
})
const horizontalOffset = ref(0)

const handleBodyScroll = (event: Event) => {
    containerProps.onScroll()
    const target = event.target as HTMLElement
    horizontalOffset.value = target.scrollLeft
}

// -------------------------------
// 查询触发（Worker）
// -------------------------------
const runQuery = async () => {
    loading.value = true
    error.value = null
    try {
        const res = await queryRows({
            q: searchText.value,
            mode: matchMode.value,
            enums: cloneForWorker(enums.value),
            ranges: cloneForWorker(ranges.value),
            sort: cloneForWorker(sort.value),
        })
        rows.value = res.rows.map(assignRowId)
        total.value = res.total
        scrollTo(0)
    } catch (e: any) {
        error.value = e?.message ?? String(e)
    } finally {
        loading.value = false
    }
}
const debouncedQuery = useDebounceFn(runQuery, 200)

// -------------------------------
// 初始化
// -------------------------------
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

// -------------------------------
// 交互
// -------------------------------
function resetAll() {
    searchText.value = ''
    matchMode.value = 'contains'
    enums.value = createDefaultEnums()
    ranges.value = createDefaultRanges()
    sort.value = [
        { id: 'itemData.online', desc: true },
        { id: 'itemData.family.index', desc: true },
        { id: 'itemData.deviceid', desc: false },
    ]
    runQuery()
}

function handleColumnVisibilityChange(columnId: string, checked: boolean | string | number) {
    if (!columnId) return
    if (typeof checked === 'string') {
        visibleCols.value[columnId] = checked === 'true'
        return
    }
    if (typeof checked === 'number') {
        visibleCols.value[columnId] = checked === 1
        return
    }
    visibleCols.value[columnId] = checked
}

watch(rows, () => {
    scrollTo(0)
})

const enumColumnMap: Record<string, keyof EnumFilters> = {
    'itemData.online': 'online',
    'itemData.extra.model': 'model',
    'itemData.extra.ui': 'ui',
    'itemData.brandName': 'brandName',
    'itemData.productModel': 'productModel',
    'itemData.params.type': 'type',
    'itemData.params.parentid': 'parentid',
}

const rangeColumnMap: Record<string, keyof RangeState> = {}

const sortableColumnMap: Record<string, SortSpec['id']> = {
    'itemData.online': 'itemData.online',
    'itemData.family.index': 'itemData.family.index',
    'itemData.deviceid': 'itemData.deviceid',
}

const renderRangeDropdown = (rangeKey: keyof RangeState) => (props: FilterDropdownProps<FlatRow>) => {
    const local = reactive<{ min?: number; max?: number }>({
        min: ranges.value[rangeKey].min,
        max: ranges.value[rangeKey].max,
    })

    const apply = () => {
        ranges.value[rangeKey] = {
            min: local.min,
            max: local.max,
        }
        props.confirm?.()
        runQuery()
    }

    const reset = () => {
        local.min = undefined
        local.max = undefined
        ranges.value[rangeKey] = { min: undefined, max: undefined }
        props.confirm?.()
        runQuery()
    }

    return h('div', { class: 'range-filter-dropdown' }, [
        h(Space, { direction: 'vertical', style: 'width: 200px' }, [
            h(AntInputNumber, {
                value: local.min,
                placeholder: '最小值',
                style: 'width: 100%',
                'onUpdate:value': (val: number | null) => {
                    local.min = typeof val === 'number' ? val : undefined
                },
            }),
            h(AntInputNumber, {
                value: local.max,
                placeholder: '最大值',
                style: 'width: 100%',
                'onUpdate:value': (val: number | null) => {
                    local.max = typeof val === 'number' ? val : undefined
                },
            }),
            h('div', { class: 'range-filter-actions' }, [
                h(
                    AntButton,
                    {
                        size: 'small',
                        onClick: reset,
                    },
                    { default: () => '清除' }
                ),
                h(
                    AntButton,
                    {
                        type: 'primary',
                        size: 'small',
                        onClick: apply,
                    },
                    { default: () => '确定' }
                ),
            ]),
        ]),
    ])
}

const enhanceColumns = (cols: ColumnsType<FlatRow>): ColumnsType<FlatRow> =>
    cols.map(col => {
        if ('children' in col && col.children) {
            return { ...col, children: enhanceColumns(col.children) }
        }
        const leaf = col as ColumnType<FlatRow>
        const key = (leaf.key || leaf.dataIndex?.toString()) as string
        const nextCol: ColumnType<FlatRow> = { ...leaf }
        const enumKey = enumColumnMap[key]
        if (enumKey) {
            const options =
                enumKey === 'online'
                    ? [
                          { text: '在线', value: 'true' },
                          { text: '离线', value: 'false' },
                      ]
                    : enumOptions.value[enumKey].map(value => ({ text: value, value }))
            nextCol.filters = options
            const selected = enums.value[enumKey]
            nextCol.filteredValue =
                selected && selected.length
                    ? enumKey === 'online'
                        ? selected.map(v => String(v))
                        : [...selected]
                    : null
            nextCol.filterMultiple = true
        }
        const rangeKey = rangeColumnMap[key]
        if (rangeKey) {
            const range = ranges.value[rangeKey]
            nextCol.filteredValue =
                range.min != null || range.max != null ? [`${range.min ?? ''}|${range.max ?? ''}`] : null
            nextCol.filterDropdown = renderRangeDropdown(rangeKey)
        }
        const sortKey = sortableColumnMap[key]
        if (sortKey) {
            const sortInfo = sort.value.find(s => s.id === sortKey)
            nextCol.sorter = true
            nextCol.sortOrder = sortInfo ? (sortInfo.desc ? 'descend' : 'ascend') : null
        }
        return nextCol
    })

const tableColumns = computed(() => enhanceColumns(antColumns.value))

function applyEnumFiltersFromTable(
    filters: Record<string, (string | number | boolean)[] | null | undefined>
): boolean {
    let changed = false
    const nextEnums = createDefaultEnums()
    Object.entries(enumColumnMap).forEach(([colKey, enumKey]) => {
        const selected = filters[colKey]
        if (selected && selected.length) {
            if (enumKey === 'online') {
                nextEnums.online = selected.map(value => value === true || value === 'true')
            } else {
                nextEnums[enumKey] = selected.map(value => String(value))
            }
        }
    })
    const prev = JSON.stringify(enums.value)
    const next = JSON.stringify(nextEnums)
    if (prev !== next) {
        enums.value = nextEnums
        changed = true
    }
    return changed
}

function applySorterFromTable(sorter: any): boolean {
    let sorterArray: any[] = []
    if (Array.isArray(sorter)) {
        sorterArray = sorter
    } else if (sorter && sorter.order) {
        sorterArray = [sorter]
    }
    const nextSort: SortSpec[] = sorterArray
        .filter(item => item.order)
        .map(item => ({
            id: (sortableColumnMap[item.columnKey as string] ||
                (item.columnKey as keyof FlatRow)) as keyof FlatRow,
            desc: item.order === 'descend',
        }))
    const prev = JSON.stringify(sort.value)
    const next = JSON.stringify(nextSort)
    if (prev !== next) {
        sort.value = nextSort
        return true
    }
    return false
}

const handleTableChange = (_pagination: unknown, filters: Record<string, any>, sorter: any) => {
    const filterChanged = applyEnumFiltersFromTable(filters)
    const sorterChanged = applySorterFromTable(sorter)
    if (filterChanged || sorterChanged) {
        runQuery()
    }
}
</script>

<template>
    <section class="page-section">
        <!-- 工具条 -->
        <div class="toolbar">
            <Space wrap class="toolbar-controls">
                <Input v-model:value="searchText" placeholder="搜索：设备ID / 名称 / 品牌 / 型号 / UI / 类型" style="width: 360px"
                    allow-clear @input="debouncedQuery()" />
                <Select v-model:value="matchMode" style="width: 140px" @change="runQuery">
                    <Select.Option value="contains">包含</Select.Option>
                    <Select.Option value="startsWith">前缀</Select.Option>
                    <Select.Option value="endsWith">后缀</Select.Option>
                    <Select.Option value="equals">等于</Select.Option>
                </Select>

                <!-- 列显隐 -->
                <Popover trigger="click" placement="bottomLeft">
                    <template #content>
                        <div class="column-popover">
                            <div class="column-popover-title">列显示</div>
                            <div v-for="c in leafColumnOptions" :key="c.key" class="column-toggle-row">
                                <span>{{ c.title }}</span>
                                <Switch :checked="visibleCols[c.key]"
                                    @change="(checked: boolean | string | number) => handleColumnVisibilityChange(c.key, checked)" />
                            </div>
                        </div>
                    </template>
                    <Button>列显示</Button>
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
                            <Table class="data-table" :columns="tableColumns" :dataSource="visibleRows" :pagination="false"
                                :rowKey="rowKey" size="small" bordered :showHeader="false"
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
    padding: 20px;
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

.toolbar :deep(.ant-select), .toolbar :deep(.ant-input) {
    transition: box-shadow 0.3s ease;
}

.toolbar :deep(.ant-select-focused), .toolbar :deep(.ant-input-focused) {
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
    width: 360px;
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

.range-filter-dropdown {
    padding: 12px;
}

.range-filter-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
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
