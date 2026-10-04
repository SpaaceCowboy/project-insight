const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');

exports.createServer=()=>{
  const root=path.resolve(__dirname,'../dist');
  if(!fs.existsSync(path.join(root,'Puzzle.html')))throw new Error('Run npm run build before browser checks.');
  return http.createServer((req,res)=>{
    let file;
    try {file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname))}
    catch {res.writeHead(400);res.end();return}
    if(file===root)file=path.join(root,'Puzzle.html');
    if(!file.startsWith(root+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()){
      res.writeHead(404);res.end();return;
    }
    const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.wav':'audio/wav'};
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
    const content=fs.readFileSync(file);res.setHeader('Content-Length',content.length);res.end(content);
  });
};
