export interface ItemExtra {
    model?: string
    ui?: string
    uiid?: number
    manufacturer?: string
    mac?: string
    apmac?: string
    modelInfo?: string
    brandId?: string
}

export interface ItemFamily {
    familyid?: string
    index?: number
    members?: unknown[]
}

export interface ItemParams {
    bindInfos?: Record<string, unknown>
    parentid?: string
    type?: string
    userName?: string
    rtspUrl?: string
    pwd?: string
    subDevices?: Array<{ deviceid: string }>
}

export interface ItemData {
    name?: string
    deviceid: string
    apikey?: string
    extra?: ItemExtra
    brandName?: string
    brandLogo?: string
    showBrand?: boolean
    productModel?: string
    tags?: Record<string, unknown>
    devConfig?: Record<string, unknown>
    settings?: Record<string, unknown>
    devGroups?: unknown[]
    family?: ItemFamily
    shareTo?: unknown[]
    devicekey?: string
    online?: boolean
    params?: ItemParams
    isSupportGroup?: boolean
    isSupportedOnMP?: boolean
    isSupportChannelSplit?: boolean
    deviceFeature?: Record<string, unknown>
}

export interface RawItem {
    itemType: number
    itemData: ItemData
    index?: number
}

export type RawData = RawItem[]

// 扁平化后的行（2~3 层）
export interface FlatRow {
    // 顶层
    itemType: number
    index?: number

    // 展开 itemData 的常用字段
    'itemData.name'?: string
    'itemData.deviceid': string
    'itemData.brandName'?: string
    'itemData.productModel'?: string
    'itemData.online'?: boolean

    // 敏感字段（默认打码、不可搜索）
    'itemData.apikey'?: string
    'itemData.devicekey'?: string

    // extra
    'itemData.extra.model'?: string
    'itemData.extra.ui'?: string
    'itemData.extra.uiid'?: number

    // params
    'itemData.params.type'?: string
    'itemData.params.parentid'?: string

    // family
    'itemData.family.familyid'?: string
    'itemData.family.index'?: number

    // 其余大对象不展开，原始保留
    __raw?: RawItem
}
