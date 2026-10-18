export default async function handler(req,res){
  try {
    const {handleRequest}=await import('../server.mjs');
    await handleRequest(req,res);
  } catch(error) {
    console.error('Winni API initialization failed:',error.name,error.code||'unknown');
    if(!res.headersSent){
      res.writeHead(503,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
      res.end(JSON.stringify({error:'La API no pudo iniciarse. Revisa la configuración del despliegue.'}));
    }else if(!res.writableEnded)res.end();
  }
}
