export function redirectSystemPath({path}:{path:string;initial:boolean}) {
  try { const url=new URL(path,'brokeriq://'); if(url.hostname==='expo-sharing'||path.includes('expo-sharing'))return '/handle-share'; }catch{}
  return path;
}
