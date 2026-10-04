const fs=require('node:fs'),path=require('node:path');
const rootPath=(...parts)=>path.resolve(__dirname,'..',...parts);
function screenshotPath(name){
  const folder=rootPath('artifacts','screenshots');
  fs.mkdirSync(folder,{recursive:true});
  return path.join(folder,name);
}
module.exports={rootPath,screenshotPath};
