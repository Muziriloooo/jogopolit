"""Run browser checks against a temporary database, never the user's operating database."""
import http.client,os,subprocess,sys,tempfile,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='sl-browser-') as tmp:
 folder=Path(tmp);env=os.environ.copy();env.update({'PORT':'5191','HOST':'127.0.0.1','DATA_DIR':str(folder/'data'),'DATABASE_URL':'','DEMO_MODE':'true','DEMO_PASSWORD':'Campo-demo-2026!','DEMO_SEED_EXAMPLES':'true','COOKIE_SECURE':'false','NODE_ENV':'development','SKIP_SCHEMA':'false','SL_API_TARGET':'http://127.0.0.1:5191','SL_URL':'http://127.0.0.1:5192'})
 # Add an archived account to exercise recovery of old local drafts after role migration.
 init="""import {database}from'./server/db.js';import{createApp}from'./server/app.js';const db=await database();await createApp(db);await db.query(\"INSERT INTO users(id,name,email,password_hash,role,disabled_at,merged_into) SELECT 'gest-demo','Conta anterior','gestor@slcampo.local',password_hash,'admin',now(),id FROM users WHERE id='adm-demo'\");await db.close();"""
 subprocess.run(['node','--input-type=module','-e',init],cwd=ROOT,env=env,check=True)
 api_log=open(folder/'api.log','w+');web_log=open(folder/'web.log','w+')
 api=subprocess.Popen(['node','server/index.js'],cwd=ROOT,env=env,stdout=api_log,stderr=subprocess.STDOUT)
 web=subprocess.Popen(['node','node_modules/vite/bin/vite.js','--port','5192','--strictPort'],cwd=ROOT,env=env,stdout=web_log,stderr=subprocess.STDOUT)
 try:
  for port,url in [(5191,'/api/health'),(5192,'/__sl/version')]:
   for _ in range(150):
    try:
     conn=http.client.HTTPConnection('127.0.0.1',port,timeout=1);conn.request('GET',url);r=conn.getresponse();r.read();conn.close()
     if r.status==200:break
    except OSError:pass
    time.sleep(.2)
   else:raise AssertionError('Fixture não iniciou: '+(folder/'api.log').read_text()+(folder/'web.log').read_text())
  for script in sys.argv[1:] or ['tests/requests.py']:
   subprocess.run([sys.executable,'-u',script],cwd=ROOT,env=env,check=True)
 finally:
  for process in [web,api]:process.terminate()
  for process in [web,api]:
   try:process.wait(timeout=10)
   except subprocess.TimeoutExpired:process.kill();process.wait()
  api_log.close();web_log.close()
