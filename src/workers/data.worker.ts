/// <reference lib="webworker" />
import { expose } from 'comlink'
import Fuse from 'fuse.js'
import { flattenItem } from '../utils/flatten'
import type { RawData, FlatRow } from '../types/data'

export type MatchMode = 'contains' | 'startsWith' | 'endsWith' | 'equals'

export interface EnumFilters {
    online?: boolean[]
    model?: string[]
    ui?: string[]
    brandName?: string[]
    productModel?: string[]
    type?: string[]
    parentid?: string[]
}

export type EnumOptionMap = {
    [K in keyof Required<EnumFilters>]: NonNullable<EnumFilters[K]>
}

export interface RangeFilters {
    uiid?: { min?: number; max?: number } // itemData.extra.uiid
    indexTop?: { min?: number; max?: number } // 顶层 index
}

export interface SortSpec {
    id: keyof FlatRow
    desc?: boolean
}

export interface QueryInput {
    // 全局搜索
    q?: string
    mode?: MatchMode        // contains / startsWith / endsWith / equals
    // 枚举筛选
    enums?: EnumFilters
    // 区间筛选
    ranges?: RangeFilters
    // 排序，可多列
    sort?: SortSpec[]
}

type SearchKey = keyof FlatRow & string

const SEARCH_KEYS: SearchKey[] = [
    'itemData.deviceid',
    'itemData.name',
    'itemData.brandName',
    'itemData.productModel',
    'itemData.extra.model',
    'itemData.extra.ui',
    'itemData.params.type',
]

let rows: FlatRow[] = []
let fuse: Fuse<FlatRow> | null = null

function buildFuse() {
    const fuseKeys = SEARCH_KEYS.map(key => ({
        name: key,
        getFn: (row: FlatRow) => row[key],
    }))
    fuse = new Fuse(rows, {
        includeMatches: true,
        threshold: 0.3,      // 模糊程度
        ignoreLocation: true,
        keys: fuseKeys as any
    })
}

function stringMatch(s: string, q: string, mode: MatchMode): boolean {
    const a = s.toLowerCase()
    const b = q.toLowerCase()
    switch (mode) {
        case 'startsWith': return a.startsWith(b)
        case 'endsWith': return a.endsWith(b)
        case 'equals': return a === b
        default: return a.includes(b)
    }
}

function passEnums(r: FlatRow, e?: EnumFilters): boolean {
    if (!e) return true
    if (e.online && e.online.length) {
        const v = r['itemData.online'] ?? false
        if (!e.online.includes(Boolean(v))) return false
    }
    if (e.model && e.model.length) {
        if (!e.model.includes(r['itemData.extra.model'] || '')) return false
    }
    if (e.ui && e.ui.length) {
        if (!e.ui.includes(r['itemData.extra.ui'] || '')) return false
    }
    if (e.brandName && e.brandName.length) {
        if (!e.brandName.includes(r['itemData.brandName'] || '')) return false
    }
    if (e.productModel && e.productModel.length) {
        if (!e.productModel.includes(r['itemData.productModel'] || '')) return false
    }
    if (e.type && e.type.length) {
        if (!e.type.includes(r['itemData.params.type'] || '')) return false
    }
    if (e.parentid && e.parentid.length) {
        if (!e.parentid.includes(r['itemData.params.parentid'] || '')) return false
    }
    return true
}

function passRanges(r: FlatRow, ranges?: RangeFilters): boolean {
    if (!ranges) return true
    const inRange = (v: number | undefined, min?: number, max?: number) => {
        if (typeof v !== 'number') return false
        if (min != null && v < min) return false
        if (max != null && v > max) return false
        return true
    }
    if (ranges.uiid && (ranges.uiid.min != null || ranges.uiid.max != null)) {
        if (!inRange(r['itemData.extra.uiid'], ranges.uiid.min, ranges.uiid.max)) return false
    }
    if (ranges.indexTop && (ranges.indexTop.min != null || ranges.indexTop.max != null)) {
        if (!inRange(r.index, ranges.indexTop.min, ranges.indexTop.max)) return false
    }
    return true
}

function sortRows(arr: FlatRow[], sort?: SortSpec[]): FlatRow[] {
    if (!sort || sort.length === 0) return arr
    const ss = sort.slice()
    return arr.slice().sort((a, b) => {
        for (const s of ss) {
            const av = a[s.id]
            const bv = b[s.id]
            if (av == null && bv == null) continue
            if (av == null) return s.desc ? 1 : -1
            if (bv == null) return s.desc ? -1 : 1
            if (av < bv) return s.desc ? 1 : -1
            if (av > bv) return s.desc ? -1 : 1
        }
        return 0
    })
}

const api = {
    async load(url: string) {
        const res = await fetch(url, { cache: 'no-cache' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const raw: RawData = await res.json()
        rows = raw.map(flattenItem)
        buildFuse()
        return { count: rows.length }
    },

    // 返回过滤后的行（供虚拟渲染）
    async query(input: QueryInput): Promise<{ rows: FlatRow[]; total: number }> {
        const { q, mode = 'contains', enums, ranges, sort } = input || {}

        let base: FlatRow[]
        if (q && q.trim()) {
            // 先模糊搜索，再做精确模式（contains/starts/ends/equals）收紧
            const qStr = q.trim()
            const fuseResult = fuse!.search(qStr)
            const prelim = fuseResult.map(r => r.item)
            base = prelim.filter(r =>
                SEARCH_KEYS.some(key => {
                    const v = r[key]
                    return typeof v === 'string' && stringMatch(v, qStr, mode)
                })
            )
        } else {
            base = rows
        }

        const filtered = base.filter(r => passEnums(r, enums) && passRanges(r, ranges))
        const sorted = sortRows(filtered, sort)
        return { rows: sorted, total: sorted.length }
    },

    // 提供枚举值集合，驱动筛选器选项
    async distinct(): Promise<EnumOptionMap> {
        const pick = <T extends string | number | boolean | null | undefined>(getter: (r: FlatRow) => T) => {
            const values = new Set<T>()
            rows.forEach(row => values.add(getter(row)))
            return Array.from(values).filter((value): value is Exclude<T, null | undefined> => value != null)
        }
        return {
            online: (pick(r => r['itemData.online']) as boolean[]),
            model: pick(r => r['itemData.extra.model']),
            ui: pick(r => r['itemData.extra.ui']),
            brandName: pick(r => r['itemData.brandName']),
            productModel: pick(r => r['itemData.productModel']),
            type: pick(r => r['itemData.params.type']),
            parentid: pick(r => r['itemData.params.parentid']),
        }
    }
}

export type WorkerAPI = typeof api
expose(api)
