export interface DeviceInfo {
    model: string
    type: string
    brand: string
    category: string
}

export interface EwlinkCloud {
    isSupported: boolean
    capabilities?: string[]
}

export interface ThirdPartyAppSupport {
    appName: string
    supportedClusters?: string[]
    notes?: string[]
}

export interface MatterDevice {
    deviceType: string
    protocolVersion?: string
    supportedClusters?: string[]
    unsupportedClusters?: string[]
    thirdPartyAppSupport?: ThirdPartyAppSupport[]
}

export interface MatterBridge {
    isSupported: boolean
    devices?: MatterDevice[]
}

export interface HomeAssistant {
    isSupported: boolean
    entities?: string[]
}

export interface RawDevice {
    deviceInfo: DeviceInfo
    ewlinkCloud?: EwlinkCloud
    matterBridge?: MatterBridge
    homeAssistant?: HomeAssistant
}

export type RawData = RawDevice[]

export interface FlatRow {
    rowId: string
    parentId: string
    isGroupHead: boolean
    groupSpan: number
    searchText: string

    deviceModel: string
    deviceType: string
    deviceBrand: string
    deviceCategory: string

    ewlinkSupported: boolean
    ewlinkCapabilities: string[]

    matterSupported: boolean
    matterDeviceType?: string
    matterProtocolVersion?: string
    matterSupportedClusters: string[]
    matterUnsupportedClusters: string[]
    appleSupported: string[]
    appleNotes: string[]
    googleSupported: string[]
    googleNotes: string[]
    smartThingsSupported: string[]
    smartThingsNotes: string[]
    alexaSupported: string[]
    alexaNotes: string[]

    homeAssistantSupported: boolean
    homeAssistantEntities: string[]
}
