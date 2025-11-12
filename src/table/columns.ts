import type { ColumnsType, ColumnType } from 'ant-design-vue/es/table'
import type { FlatRow } from '@/types/data'
import { maskSensitive } from '@/utils/flatten'

type FlatKey = Extract<keyof FlatRow, string>

const boolCell = (value?: boolean) => (value ? '是' : '否')

const column = (
    key: FlatKey | string,
    title: string,
    options: Partial<ColumnType<FlatRow>> = {}
): ColumnType<FlatRow> => ({
    key,
    dataIndex: key as ColumnType<FlatRow>['dataIndex'],
    title,
    ellipsis: true,
    align: 'left',
    width: 160,
    ...options,
})

export const baseColumns: ColumnsType<FlatRow> = [
    {
        title: '设备基础信息',
        key: 'group-device',
        fixed: 'left',
        children: [
            column('itemType', '设备类型', { width: 140, fixed: 'left' }),
            column('index', '原始序号', { width: 120, align: 'center', fixed: 'left' }),
            column('itemData.deviceid', '设备 ID', { width: 220, fixed: 'left' }),
            column('itemData.name', '设备名称', { width: 200 }),
            column('itemData.brandName', '品牌', { width: 140 }),
            column('itemData.productModel', '产品型号', { width: 180 }),
        ],
    },
    {
        title: '固件 / 在线状态',
        key: 'group-status',
        children: [
            column('itemData.online', '在线状态', {
                width: 120,
                align: 'center',
                customRender: ({ value }) => boolCell(value as boolean | undefined),
            }),
            column('itemData.extra.ui', 'UI 标识', { width: 160 }),
            column('itemData.extra.uiid', 'UIID', { width: 120, align: 'center' }),
            column('itemData.extra.model', '硬件型号', { width: 200 }),
        ],
    },
    {
        title: '关联 / 分组',
        key: 'group-relation',
        children: [
            column('itemData.params.type', '设备类型(type)', { width: 160 }),
            column('itemData.params.parentid', '父设备 ID', { width: 220 }),
        ],
    },
    {
        title: '凭证 / 打码展示',
        key: 'group-credential',
        children: [
            column('itemData.apikey', 'API Key(打码)', {
                width: 220,
                customRender: ({ value }) => maskSensitive(value as string | undefined),
            }),
            column('itemData.devicekey', 'Device Key(打码)', {
                width: 240,
                customRender: ({ value }) => maskSensitive(value as string | undefined),
            }),
        ],
    },
]

const collectLeafColumns = (cols: ColumnsType<FlatRow>, bucket: ColumnType<FlatRow>[] = []) => {
    cols.forEach(col => {
        if ('children' in col && col.children) {
            collectLeafColumns(col.children, bucket)
        } else {
            bucket.push(col as ColumnType<FlatRow>)
        }
    })
    return bucket
}

export const leafColumns = collectLeafColumns(baseColumns)

export const buildDefaultVisibility = (): Record<string, boolean> => {
    const result: Record<string, boolean> = {}
    leafColumns.forEach(col => {
        const key = (col.key || col.dataIndex?.toString()) as string
        if (key) result[key] = true
    })
    return result
}

export const filterColumnsByVisibility = (
    cols: ColumnsType<FlatRow>,
    visible: Record<string, boolean>
): ColumnsType<FlatRow> => {
    const next: ColumnsType<FlatRow> = []
    cols.forEach(col => {
        if ('children' in col && col.children) {
            const filteredChildren = filterColumnsByVisibility(col.children, visible)
            if (filteredChildren.length) {
                next.push({ ...col, children: filteredChildren })
            }
            return
        }
        const leaf = col as ColumnType<FlatRow>
        const key = (leaf.key || leaf.dataIndex?.toString()) as string | undefined
        if (!key || visible[key] !== false) {
            next.push(leaf)
        }
    })
    return next
}

export const sumColumnWidth = (cols: ColumnsType<FlatRow>): number =>
    collectLeafColumns(cols).reduce((acc, col) => {
        if (!col.width) return acc + 160
        if (typeof col.width === 'number') return acc + col.width
        const parsed = parseInt(col.width, 10)
        return acc + (Number.isNaN(parsed) ? 160 : parsed)
    }, 0)
