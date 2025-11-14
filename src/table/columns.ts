import type { ColumnsType, ColumnType } from 'ant-design-vue/es/table'
import type { FlatRow } from '@/types/data'

export type GroupKey = 'ewlink' | 'matter' | 'homeAssistant'

const boolIcon = (value?: boolean) => (value ? '✔' : '—')
const listDisplay = (list: string[]) => (list.length ? list.join('、') : '—')

const createColumn = (
    key: keyof FlatRow | string,
    title: string,
    options: Partial<ColumnType<FlatRow>> = {},
    span = true
): ColumnType<FlatRow> => ({
    key,
    dataIndex: key as ColumnType<FlatRow>['dataIndex'],
    title,
    ellipsis: true,
    width: 160,
    align: 'left',
    customCell: span
        ? ((record: FlatRow) => ({
              rowSpan: record.isGroupHead ? record.groupSpan : 0,
          }))
        : undefined,
    ...options,
})

const deviceInfoColumns: ColumnsType<FlatRow> = [
    createColumn('deviceModel', '设备型号', { width: 180, fixed: 'left' }),
    createColumn('deviceType', '设备类型', { width: 140 }),
    createColumn('deviceBrand', '品牌', { width: 140 }),
    createColumn('deviceCategory', '设备类别', { width: 160 }),
]

const ewlinkColumns: ColumnsType<FlatRow> = [
    createColumn(
        'ewlinkSupported',
        '云支持',
        {
            width: 120,
            align: 'center',
            customRender: ({ record }) => boolIcon(record.ewlinkSupported),
        }
    ),
    createColumn(
        'ewlinkCapabilities',
        '支持能力',
        {
            width: 220,
            customRender: ({ record }) => listDisplay(record.ewlinkCapabilities),
        }
    ),
]

const matterColumns: ColumnsType<FlatRow> = [
    createColumn(
        'matterSupported',
        'Bridge 支持',
        {
            width: 120,
            align: 'center',
            customRender: ({ record }) => boolIcon(record.matterSupported),
        }
    ),
    createColumn('matterDeviceType', 'Matter Device Type', { width: 220 }, false),
    createColumn(
        'matterSupportedClusters',
        'Cluster 支持情况',
        {
            width: 260,
            customRender: ({ record }) =>
                stringifyClusterInfo(record.matterSupportedClusters, record.matterUnsupportedClusters),
        },
        false
    ),
    createColumn('matterProtocolVersion', 'Matter 协议版本', { width: 160 }, false),
    createColumn(
        'appleSupported',
        'Apple Home',
        {
            width: 220,
            customRender: ({ record }) => withNotes(record.appleSupported, record.appleNotes),
        },
        false
    ),
    createColumn(
        'googleSupported',
        'Google Home',
        {
            width: 220,
            customRender: ({ record }) => withNotes(record.googleSupported, record.googleNotes),
        },
        false
    ),
    createColumn(
        'smartThingsSupported',
        'SmartThings',
        {
            width: 220,
            customRender: ({ record }) => withNotes(record.smartThingsSupported, record.smartThingsNotes),
        },
        false
    ),
    createColumn(
        'alexaSupported',
        'Alexa',
        {
            width: 220,
            customRender: ({ record }) => withNotes(record.alexaSupported, record.alexaNotes),
        },
        false
    ),
]

const homeAssistantColumns: ColumnsType<FlatRow> = [
    createColumn(
        'homeAssistantSupported',
        '同步到 HA',
        {
            width: 140,
            align: 'center',
            customRender: ({ record }) => boolIcon(record.homeAssistantSupported),
        }
    ),
    createColumn(
        'homeAssistantEntities',
        'entities',
        {
            width: 200,
            customRender: ({ record }) => listDisplay(record.homeAssistantEntities),
        }
    ),
]

function withNotes(supported: string[], notes: string[]) {
    if (!supported.length && !notes.length) return '—'
    const segments: string[] = []
    if (supported.length) segments.push(`支持: ${supported.join(', ')}`)
    if (notes.length) segments.push(`备注: ${notes.join('; ')}`)
    return segments.join(' | ')
}

function stringifyClusterInfo(supported: string[], unsupported: string[]) {
    if (!supported.length && !unsupported.length) return '—'
    const pieces: string[] = []
    if (supported.length) pieces.push(`支持: ${supported.join(', ')}`)
    if (unsupported.length) pieces.push(`不支持: ${unsupported.join(', ')}`)
    return pieces.join(' | ')
}

type ColumnWithGroup = ColumnType<FlatRow> & { groupKey?: GroupKey }

export const baseColumns: ColumnsType<FlatRow> = [
    {
        title: '设备信息',
        key: 'group-device',
        fixed: 'left',
        children: deviceInfoColumns,
    },
    {
        title: '易微联云',
        key: 'group-ewlink',
        groupKey: 'ewlink',
        children: ewlinkColumns as ColumnsType<FlatRow>,
    } as ColumnWithGroup,
    {
        title: 'Matter Bridge',
        key: 'group-matter',
        groupKey: 'matter',
        children: matterColumns as ColumnsType<FlatRow>,
    } as ColumnWithGroup,
    {
        title: 'Home Assistant',
        key: 'group-homeassistant',
        groupKey: 'homeAssistant',
        children: homeAssistantColumns as ColumnsType<FlatRow>,
    } as ColumnWithGroup,
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

export const filterColumnsByGroup = (
    cols: ColumnsType<FlatRow>,
    visibleGroups: Record<GroupKey, boolean>
): ColumnsType<FlatRow> => {
    const result: ColumnsType<FlatRow> = []
    cols.forEach(col => {
        const groupKey = (col as ColumnWithGroup).groupKey
        if (groupKey && visibleGroups[groupKey] === false) return
        if ('children' in col && col.children) {
            const children = filterColumnsByGroup(col.children, visibleGroups)
            if (children.length) result.push({ ...col, children })
            return
        }
        result.push(col)
    })
    return result
}

export const sumColumnWidth = (cols: ColumnsType<FlatRow>): number =>
    collectLeafColumns(cols).reduce((acc, col) => {
        if (!col.width) return acc + 160
        if (typeof col.width === 'number') return acc + col.width
        const parsed = parseInt(col.width, 10)
        return acc + (Number.isNaN(parsed) ? 160 : parsed)
    }, 0)
