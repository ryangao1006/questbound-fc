/** Both global and mainland-China iCloud discovery can return regional hosts. */
export function isICloudCalendarURL(url: URL): boolean {
    return url.protocol === 'https:' && !url.username && !url.password &&
        (!url.port || url.port === '443') &&
        ['icloud.com', 'icloud.com.cn'].some(domain =>
            url.hostname === domain || url.hostname.endsWith(`.${domain}`));
}

/** Workers supports manual redirects; validate every destination before sending auth. */
export async function fetchICloudResource(url: URL, authorization: string, request: typeof fetch = fetch): Promise<Response> {
    for (let i = 0; i < 5; i++) {
        if (!isICloudCalendarURL(url)) throw new Error('Unexpected iCloud calendar address.');
        const response = await request(url, { headers: { Authorization: authorization }, redirect: 'manual', signal: AbortSignal.timeout(15000) });
        if (![301, 302, 303, 307, 308].includes(response.status)) return response;
        const location = response.headers.get('location');
        if (!location) throw new Error('Missing iCloud redirect address.');
        await response.body?.cancel();
        url = new URL(location, url);
    }
    throw new Error('Too many iCloud redirects.');
}
