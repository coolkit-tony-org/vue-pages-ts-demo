export async function loadLargeData<T = unknown>(): Promise<T> {
    const res = await fetch(`${import.meta.env.BASE_URL}data/large.json?v=${Date.now()}`)
    if (!res.ok) throw new Error(`Failed to load data: ${res.status}`)
    return res.json() as Promise<T>
}