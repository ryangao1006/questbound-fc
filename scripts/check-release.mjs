import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {homedir} from 'node:os';
import path from 'node:path';
const root=process.cwd();
const baseline=JSON.parse(await readFile(path.join(root,'.openai/release-contract.json'),'utf8'));
const hosting=JSON.parse(await readFile(path.join(root,'.openai/hosting.json'),'utf8'));
for(const key of ['project_id','d1','r2'])if(hosting[key]!==baseline.hosting[key])throw Error(`Release blocked: preserve the existing ${key} identity and storage binding.`);
const sql={};for(const name of (await readdir('drizzle')).filter(n=>n.endsWith('.sql')).sort())sql[name]=createHash('sha256').update(await readFile(path.join('drizzle',name))).digest('hex');
for(const [name,digest] of Object.entries(baseline.migrations))if(sql[name]!==digest)throw Error(`Release blocked: applied migration ${name} is immutable. Add a new numbered migration.`);
const assets=JSON.parse(await readFile('.openai/asset-contract.json','utf8'));for(const version of Object.values(assets.versions))for(const [name,file]of Object.entries(version.files)){const bytes=await readFile(path.join(version.directory,name));if(bytes.length!==file.bytes||createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('Published player assets are immutable. Add a new asset version.');}
const engines=JSON.parse(await readFile('.openai/football-engine-contract.json','utf8'));for(const files of Object.values(engines.versions))for(const [file,digest]of Object.entries(files))if(createHash('sha256').update(await readFile(file)).digest('hex')!==digest)throw Error('Published football engines are immutable. Retain this engine and add a new version.');
const model=await readFile('lib/model.ts','utf8');const version=Number(model.match(/SCHEMA_VERSION\s*=\s*(\d+)/)?.[1]);
if(!version||version<baseline.schemaVersion)throw Error('Release blocked: data schema versions must never move backwards.');
const changed=version!==baseline.schemaVersion||Object.keys(sql).length!==Object.keys(baseline.migrations).length;
if(changed){
 const migrationTests=spawnSync('python3',['tests/migration_test.py'],{stdio:'inherit'});if(migrationTests.status!==0)throw Error('Migration preservation checks failed.');
 const domainTests=spawnSync(process.execPath,['--experimental-strip-types','--test','tests/domain.test.ts','tests/redesign.test.ts','tests/player-assets.test.ts'],{stdio:'inherit'});if(domainTests.status!==0)throw Error('Data migration and recovery tests failed.');
 const helper=path.join(homedir(),'Library/Application Support/Quest Island/bin/backup-helper.py');
 const result=spawnSync('python3',[helper,'--pre-update'],{encoding:'utf8'});
 if(result.status!==0)throw Error('Release blocked: connect the Mac backup helper and create a verified pre-update recovery point. Existing data has not been changed.');
 let receipt;try{receipt=JSON.parse(result.stdout.trim().split('\n').at(-1));}catch{throw Error('Release blocked: pre-update verification receipt is unavailable.');}
 if(!receipt?.verified||!receipt.snapshotId||!receipt.checksum)throw Error('Release blocked: the pre-update archive was not verified.');
 await mkdir('.sites-runtime',{recursive:true});await writeFile('.sites-runtime/pre-update-receipt.json',JSON.stringify({...receipt,createdAt:new Date().toISOString(),migrations:sql,schemaVersion:version},null,2));
 console.log('Verified pre-update recovery point saved to the cloud and independent Mac archive.');
}
console.log('Release identity, append-only migrations and data compatibility checked.');
