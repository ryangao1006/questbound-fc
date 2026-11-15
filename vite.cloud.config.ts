import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
export default defineConfig({
 root:path.resolve('cloud-client'),publicDir:path.resolve('public'),resolve:{alias:{'@':path.resolve('.')}},plugins:[react(),{
  name:'qfc-static-offline-manifest',
  closeBundle(){const out=path.resolve('dist/cloud-client'),files=fs.readdirSync(path.join(out,'assets')).filter(f=>/\.(js|css)$/.test(f)).map(f=>'/assets/'+f);fs.writeFileSync(path.join(out,'offline-assets.json'),JSON.stringify(['/','/index.html',...files]));fs.copyFileSync(path.resolve('cloud-client/sw.js'),path.join(out,'sw.js'));}
 }],build:{outDir:path.resolve('dist/cloud-client'),emptyOutDir:true,rollupOptions:{output:{manualChunks:(id:string)=>id.includes('/node_modules/react/')||id.includes('/node_modules/react-dom/')?'react':undefined}}},
});
