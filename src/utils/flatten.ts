import type { FlatRow, RawItem } from "../types/data"

export function maskSensitive(value?: string): string {
    if (!value) return ''
    if (value.length <= 8) return value[0] + '****' + value[value.length - 1]
    return value.slice(0, 4) + '****' + value.slice(-4)
}

export function flattenItem(it: RawItem): FlatRow {
    const d = it.itemData || {}

    const row: FlatRow = {
        itemType: it.itemType,
        index: it.index,
        'itemData.name': d.name,
        'itemData.deviceid': d.deviceid,
        'itemData.brandName': d.brandName,
        'itemData.productModel': d.productModel,
        'itemData.online': d.online,
        'itemData.apikey': d.apikey,        // 展示时再打码
        'itemData.devicekey': d.devicekey,  // 展示时再打码
        'itemData.extra.model': d.extra?.model,
        'itemData.extra.ui': d.extra?.ui,
        'itemData.extra.uiid': d.extra?.uiid,
        'itemData.params.type': d.params?.type,
        'itemData.params.parentid': d.params?.parentid,
        'itemData.family.familyid': d.family?.familyid,
        'itemData.family.index': d.family?.index,
        __raw: it
    }

    return row
}
