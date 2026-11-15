import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/** Static demo bundle for GitHub Pages: the club game runs fully client-side. */
export default defineConfig({
 root:path.resolve(__dirname,'demo'),
 plugins:[react()],
 base:'/questbound-fc/',
 resolve:{alias:[{find:'@',replacement:path.resolve(__dirname,'.')},{find:/^next\/link$/,replacement:path.resolve(__dirname,'demo/next-link.tsx')}]},
 build:{outDir:path.resolve(__dirname,'dist-demo'),emptyOutDir:true},
});
