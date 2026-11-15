#!/usr/bin/env python3
"""Questbound FC backup-only companion. Secrets are held in macOS Keychain."""
import argparse, datetime as dt, hashlib, json, os, pathlib, re, shutil, subprocess, sys, tempfile, urllib.request, urllib.error, urllib.parse
ROOT = pathlib.Path.home() / 'Library/Application Support/Quest Island'
BACKUPS = ROOT / 'Backups'
SETTINGS = ROOT / 'helper.json'
SERVICE = 'Quest Island Backup'
EXPECTED_HOST = 'quest-island-ryan.gaoryan680.chatgpt.site'
CLOUD_HOST = 'questbound-fc-cloud.questbound-gaoryan680.workers.dev'

def valid_site_url(value):
    url=urllib.parse.urlparse(value)
    if url.scheme!='https' or url.hostname not in (EXPECTED_HOST,CLOUD_HOST) or url.username or url.password or url.port or url.path not in ('','/') or url.query or url.fragment:
        raise RuntimeError('This setup file does not belong to your Questbound FC site.')
    return url

def auth_headers(config,secrets):
    url=valid_site_url(config['siteUrl'])
    headers={'Authorization':'Bearer '+secrets['token'],'Content-Type':'application/json'}
    if url.hostname==EXPECTED_HOST:
        if not secrets.get('siteAccessToken'):raise RuntimeError('Private-site backup access has not been configured yet.')
        headers['OAI-Sites-Authorization']='Bearer '+secrets['siteAccessToken']
    return headers

def keychain(account, value=None):
    # Use macOS Security directly, so secret values never enter process arguments.
    import ctypes as c
    security=c.CDLL('/System/Library/Frameworks/Security.framework/Security')
    core=c.CDLL('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')
    security.SecKeychainAddGenericPassword.argtypes=[c.c_void_p,c.c_uint32,c.c_char_p,c.c_uint32,c.c_char_p,c.c_uint32,c.c_void_p,c.POINTER(c.c_void_p)]
    security.SecKeychainFindGenericPassword.argtypes=[c.c_void_p,c.c_uint32,c.c_char_p,c.c_uint32,c.c_char_p,c.POINTER(c.c_uint32),c.POINTER(c.c_void_p),c.POINTER(c.c_void_p)]
    security.SecKeychainItemModifyAttributesAndData.argtypes=[c.c_void_p,c.c_void_p,c.c_uint32,c.c_void_p]
    security.SecKeychainItemFreeContent.argtypes=[c.c_void_p,c.c_void_p]
    core.CFRelease.argtypes=[c.c_void_p]
    service=SERVICE.encode();name=account.encode();item=c.c_void_p()
    if value is None:
        length=c.c_uint32();data=c.c_void_p()
        status=security.SecKeychainFindGenericPassword(None,len(service),service,len(name),name,c.byref(length),c.byref(data),c.byref(item))
        if status:raise RuntimeError('Keychain access failed. Reconnect the helper and allow Keychain access.')
        try:return c.string_at(data,length.value).decode()
        finally:
            security.SecKeychainItemFreeContent(None,data)
            if item:core.CFRelease(item)
    raw=value.encode();buffer=c.create_string_buffer(raw)
    status=security.SecKeychainAddGenericPassword(None,len(service),service,len(name),name,len(raw),buffer,c.byref(item))
    if status==-25299:
        status=security.SecKeychainFindGenericPassword(None,len(service),service,len(name),name,None,None,c.byref(item))
        if not status:status=security.SecKeychainItemModifyAttributesAndData(item,None,len(raw),buffer)
    if item:core.CFRelease(item)
    if status:raise RuntimeError('Keychain access failed. Reconnect the helper and allow Keychain access.')
    return None

def atomic_write(path, data):
    path=pathlib.Path(path); path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    fd,temp=tempfile.mkstemp(prefix='.qi-',suffix='.tmp',dir=path.parent)
    try:
        with os.fdopen(fd,'wb') as stream:
            os.chmod(temp,0o600); stream.write(data); stream.flush(); os.fsync(stream.fileno())
        os.replace(temp,path)
        directory=os.open(path.parent,os.O_RDONLY)
        try: os.fsync(directory)
        finally: os.close(directory)
    finally:
        if os.path.exists(temp): os.unlink(temp)

def request(config, path, body=None):
    secrets=json.loads(keychain(config['deviceId']))
    data=None if body is None else json.dumps(body).encode()
    req=urllib.request.Request(config['siteUrl']+'/api/helper/'+path,data=data,headers=auth_headers(config,secrets))
    try:
        with urllib.request.urlopen(req,timeout=60) as response:
            raw=response.read(20*1024*1024+1)
            if len(raw)>20*1024*1024: raise RuntimeError('Backup exceeds the safe download size.')
            return raw
    except urllib.error.HTTPError as e:
        if e.code in (401,403): raise RuntimeError('Backup sign-in needs reconnecting in Questbound FC Settings.') from None
        raise RuntimeError('The backup service is unavailable. Existing local copies are unchanged.') from None

def selected(rows):
    rows=sorted(rows,key=lambda r:r['created_at'],reverse=True)
    keep={r['id'] for r in rows[:24]};days=set();months=set()
    for r in rows:
        day=r['created_at'][:10];month=r['created_at'][:7]
        if day not in days and len(days)<30: days.add(day);keep.add(r['id'])
        if month not in months and len(months)<12: months.add(month);keep.add(r['id'])
    keep.update(r['id'] for r in [r for r in rows if r.get('kind') in ('pre-update','pre-restore')][:10])
    return keep

def once(config):
    BACKUPS.mkdir(parents=True,exist_ok=True,mode=0o700)
    rows=json.loads(request(config,'backups'))['backups']
    for row in rows:
        if not row.get('verified'):continue
        ident=row['id']
        if not re.fullmatch(r'[a-zA-Z0-9-]{1,128}',ident) or not re.fullmatch(r'[a-f0-9]{64}',row['checksum']):raise RuntimeError('Invalid backup metadata received.')
        target=BACKUPS/(ident+'.qibak')
        existing=target.exists() and hashlib.sha256(target.read_bytes()).hexdigest()==row['checksum']
        raw=target.read_bytes() if existing else request(config,'download/'+ident)
        if hashlib.sha256(raw).hexdigest()!=row['checksum']:raise RuntimeError('Backup checksum failed. Previous copies were preserved.')
        atomic_write(target,raw)
        atomic_write(BACKUPS/(ident+'.json'),json.dumps(row,indent=2).encode())
        # A local OneDrive mirror is not claimed as a remotely verified upload.
        cloud=config.get('oneDriveMirror')
        if cloud:
            mirror=pathlib.Path(cloud)
            atomic_write(mirror/(ident+'.qibak'),raw)
            atomic_write(mirror/(ident+'.json'),json.dumps(row,indent=2).encode())
        request(config,'ack',{'id':ident,'checksum':row['checksum']})
    manifests=[]
    for file in BACKUPS.glob('*.json'):
        try: manifests.append(json.loads(file.read_text()))
        except (ValueError,OSError): continue
    # Retention is based on independent local history, never remote deletions.
    keep=selected(manifests)
    if rows and any((BACKUPS/(r['id']+'.qibak')).exists() for r in rows):
        for r in manifests:
            if r['id'] not in keep:
                for suffix in ('.qibak','.json'):(BACKUPS/(r['id']+suffix)).unlink(missing_ok=True)
    atomic_write(ROOT/'status.json',json.dumps({'lastSuccess':dt.datetime.now(dt.timezone.utc).isoformat(),'backups':len(list(BACKUPS.glob('*.qibak')))}).encode())
    print('Questbound FC: local recovery copies checked and preserved.')

def enroll(file):
    source=pathlib.Path(file).expanduser();os.chmod(source,0o600)
    data=json.loads(source.read_text());url=valid_site_url(data['siteUrl'])
    auth_headers({'siteUrl':data['siteUrl']},data)
    ROOT.mkdir(parents=True,exist_ok=True,mode=0o700)
    keychain(data['id'],json.dumps({'token':data['token'],**({'siteAccessToken':data['siteAccessToken']} if data.get('siteAccessToken') else {})}))
    keychain('recovery-key' if url.hostname==EXPECTED_HOST else 'recovery-key:'+url.hostname,data['recoveryKey'])
    cloud=pathlib.Path.home()/'Library/CloudStorage/OneDrive-Personal'
    config={'deviceId':data['id'],'siteUrl':data['siteUrl'].rstrip('/')}
    if cloud.is_dir():config['oneDriveMirror']=str(cloud/'Apps/Quest Island/Backups')
    atomic_write(SETTINGS,json.dumps(config,indent=2).encode())
    source.unlink()
    print('Questbound FC: backup-only access and recovery key saved in Mac Keychain.')
    once(config)

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--enroll');parser.add_argument('--once',action='store_true');parser.add_argument('--status',action='store_true');parser.add_argument('--pre-update',action='store_true');parser.add_argument('--export-recovery-key');args=parser.parse_args()
    if args.enroll:return enroll(args.enroll)
    if args.export_recovery_key:
        atomic_write(pathlib.Path(args.export_recovery_key).expanduser(),('Quest Island recovery key\n\n'+keychain('recovery-key:'+valid_site_url(json.loads(SETTINGS.read_text())['siteUrl']).hostname if SETTINGS.exists() and valid_site_url(json.loads(SETTINGS.read_text())['siteUrl']).hostname==CLOUD_HOST else 'recovery-key')+'\n').encode());print('Recovery key exported privately. Keep it separately from the archives.');return
    if args.status:
        status=ROOT/'status.json';print(status.read_text() if status.exists() else 'No verified local backup yet.');return
    if not SETTINGS.exists():raise RuntimeError('Enroll the helper using a setup file from Quest Island Settings first.')
    config=json.loads(SETTINGS.read_text())
    if args.pre_update:
        receipt=json.loads(request(config,'pre-update',{}))
        once(config)
        print(json.dumps({'verified':True,'snapshotId':receipt['id'],'checksum':receipt['checksum']}))
    else:once(config)
if __name__=='__main__':
    try:main()
    except Exception as e:
        ROOT.mkdir(parents=True,exist_ok=True,mode=0o700)
        message=str(e) if isinstance(e,RuntimeError) else 'The backup check could not finish. Existing copies are preserved.'
        atomic_write(ROOT/'last-error.json',json.dumps({'at':dt.datetime.now(dt.timezone.utc).isoformat(),'message':message}).encode())
        print('Questbound FC: '+message,file=sys.stderr);sys.exit(1)
