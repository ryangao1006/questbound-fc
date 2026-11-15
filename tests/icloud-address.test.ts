import test from 'node:test';
import assert from 'node:assert/strict';
import { isICloudCalendarURL } from '../lib/icloud-address.ts';

test('iCloud discovery and resource checks accept global and China-region calendars', () => {
    for (const host of ['caldav.icloud.com', 'p213-caldav.icloud.com.cn', 'icloud.com.cn', 'p01-caldav.icloud.com']) {
        assert.equal(isICloudCalendarURL(new URL(`https://${host}/example/calendars/`)), true);
    }
});

test('iCloud calendar credentials remain restricted to Apple HTTPS hosts', () => {
    for (const address of ['http://caldav.icloud.com/', 'https://icloud.com.attacker.test/',
        'https://noticloud.com.cn/', 'https://icloud.com.cn.attacker.test/',
        'https://user:password@caldav.icloud.com/', 'https://caldav.icloud.com:8443/']) {
        assert.equal(isICloudCalendarURL(new URL(address)), false);
    }
});

test('resource verification follows regional redirects and retains a real deletion response', async () => {
    const {fetchICloudResource} = await import('../lib/icloud-address.ts');
    const hosts: string[] = [];
    const fake = (async (input: URL | RequestInfo, init?: RequestInit) => {
        const u = new URL(String(input)); hosts.push(u.hostname);
        assert.equal(init?.redirect, 'manual');
        return hosts.length === 1 ? new Response(null, {status:302, headers:{location:'https://p213-caldav.icloud.com.cn/example'}}) : new Response(null,{status:404});
    }) as typeof fetch;
    assert.equal((await fetchICloudResource(new URL('https://caldav.icloud.com/example'),'Basic test',fake)).status,404);
    assert.equal(hosts.length,2);
    let calls=0;
    const hostile = (async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://attacker.test/'}});}) as typeof fetch;
    await assert.rejects(fetchICloudResource(new URL('https://caldav.icloud.com/example'),'Basic test',hostile));
    assert.equal(calls,1);
});
