const DATA_URL = new URL('../assets/data/large.json?url', import.meta.url).href

export async function loadLargeData<T = unknown>(): Promise<T> {
    const res = await fetch(DATA_URL, { cache: 'no-cache' })
    if (!res.ok) throw new Error(`Failed to load data: ${res.status}`)
    return res.json() as Promise<T>
}
