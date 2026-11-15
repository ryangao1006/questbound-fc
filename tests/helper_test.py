import unittest,importlib.util,pathlib,tempfile,json,hashlib
SOURCE=pathlib.Path(__file__).resolve().parents[1]/'public/downloads/backup-helper.py'
spec=importlib.util.spec_from_file_location('quest_backup',SOURCE)
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)

class BackupHelperChecks(unittest.TestCase):
 def test_retry_acknowledges_an_already_downloaded_archive(self):
  with tempfile.TemporaryDirectory() as directory:
   helper.ROOT=pathlib.Path(directory)/'local';helper.BACKUPS=helper.ROOT/'Backups'
   raw=b'ciphertext-only-test';checksum=hashlib.sha256(raw).hexdigest()
   row={'id':'test-snapshot','checksum':checksum,'verified':1,'created_at':'2026-11-12T09:00:00Z','kind':'hourly'}
   calls=[]
   def request(config,path,body=None):
    calls.append(path)
    if path=='backups':return json.dumps({'backups':[row]}).encode()
    if path.startswith('download/'):return raw
    if path=='ack' and calls.count('ack')==1:raise RuntimeError('Temporary connection failure')
    return b'{}'
   helper.request=request
   config={'oneDriveMirror':str(pathlib.Path(directory)/'onedrive')}
   with self.assertRaises(RuntimeError):helper.once(config)
   target=helper.BACKUPS/'test-snapshot.qibak';self.assertEqual(target.read_bytes(),raw)
   helper.once(config)
   self.assertEqual(calls.count('ack'),2);self.assertEqual(calls.count('download/test-snapshot'),1)
   self.assertEqual((pathlib.Path(config['oneDriveMirror'])/target.name).read_bytes(),raw)
 def test_unavailable_service_preserves_independent_local_copies(self):
  with tempfile.TemporaryDirectory() as directory:
   helper.ROOT=pathlib.Path(directory);helper.BACKUPS=helper.ROOT/'Backups';helper.BACKUPS.mkdir()
   saved=helper.BACKUPS/'last-good.qibak';saved.write_bytes(b'previous-good-copy')
   def unavailable(*args,**kwargs):raise RuntimeError('Sleeping or disconnected')
   helper.request=unavailable
   with self.assertRaises(RuntimeError):helper.once({})
   self.assertEqual(saved.read_bytes(),b'previous-good-copy')
class BackupHostChecks(unittest.TestCase):
 def test_exact_cloud_host_uses_backup_bearer_without_private_site_token(self):
  headers=helper.auth_headers({'siteUrl':'https://'+helper.CLOUD_HOST},{'token':'backup-only-test'})
  self.assertEqual(headers['Authorization'],'Bearer backup-only-test')
  self.assertNotIn('OAI-Sites-Authorization',headers)
 def test_legacy_host_still_requires_platform_access(self):
  with self.assertRaises(RuntimeError):helper.auth_headers({'siteUrl':'https://'+helper.EXPECTED_HOST},{'token':'test'})
 def test_unknown_host_and_disguised_origin_are_rejected(self):
  for url in ['https://evil.example','http://'+helper.CLOUD_HOST,'https://'+helper.CLOUD_HOST+'.evil.example','https://user@'+helper.CLOUD_HOST,'https://'+helper.CLOUD_HOST+'/extra']:
   with self.assertRaises(RuntimeError):helper.valid_site_url(url)
 def test_installer_embeds_the_current_helper(self):
  installer=(SOURCE.parent/'install-backup-helper.sh').read_text()
  embedded=installer.split("<<'QUEST_ISLAND_HELPER'\n",1)[1].split('\nQUEST_ISLAND_HELPER',1)[0]
  self.assertEqual(embedded,SOURCE.read_text().rstrip())

if __name__=='__main__':unittest.main()
