"""PWA release updates: real service workers, mutable published builds, protected drafts."""
import json,re,shutil,tempfile,threading
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright,expect

ROOT=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
 folder=Path(tmp);shutil.copytree(ROOT/'dist',folder,dirs_exist_ok=True)
 original=(folder/'sw.js').read_text()
 authenticated={'enabled':False}
 class Handler(SimpleHTTPRequestHandler):
  def __init__(self,*args,**kwargs):super().__init__(*args,directory=tmp,**kwargs)
  def log_message(self,*args):pass
  def end_headers(self):self.send_header('Cache-Control','no-store');super().end_headers()
  def do_GET(self):
   if self.path.startswith('/api/'):
    if authenticated['enabled'] and self.path in ['/api/me','/api/orders','/api/users']:
     payload={'user':{'id':'update-test','name':'Teste','email':'test@local.test','role':'tecnico'},'demo':True} if self.path=='/api/me' else []
     self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(payload).encode());return
    self.send_response(401);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(b'{"error":"Entre novamente"}');return
   super().do_GET()
 server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
 url='http://127.0.0.1:'+str(server.server_port)
 def publish(version):
  (folder/'sw.js').write_text(re.sub(r"sl-campo-[a-f0-9]{12}",f'sl-campo-release-{version}',original))
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  context=browser.new_context();page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(url);expect(page.get_by_role('heading',name='Vamos ao trabalho?')).to_be_visible()
  page.evaluate("navigator.serviceWorker.ready.then(()=>new Promise(resolve=>{if(navigator.serviceWorker.controller)resolve(true);else navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(true),{once:true})}))")
  page.evaluate('window.releaseMarker="initial"')
  # A focused login input blocks a reload; its current value remains untouched.
  page.get_by_label('E-mail corporativo').fill('rascunho@teste.local')
  publish('b');page.evaluate('navigator.serviceWorker.getRegistration().then(r=>r.update())')
  page.wait_for_function('navigator.serviceWorker.getRegistration().then(r=>Boolean(r.waiting))')
  assert page.evaluate('window.releaseMarker')=='initial'
  expect(page.get_by_label('E-mail corporativo')).to_have_value('rascunho@teste.local')
  page.get_by_role('heading',name='Vamos ao trabalho?').click()
  page.wait_for_function('window.releaseMarker===undefined',timeout=15000)
  expect(page.get_by_role('heading',name='Vamos ao trabalho?')).to_be_visible()
  # Cache switching never clears IndexedDB, even with an unsent order.
  page.evaluate('''async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('sl-campo',1);r.onsuccess=()=>resolve(r.result);r.onerror=reject});const tx=db.transaction(['meta','orders'],'readwrite');tx.objectStore('meta').put({id:'update-test',name:'Teste',email:'test@local.test',role:'tecnico'},'user');tx.objectStore('orders').put({key:'update-test:draft',owner:'update-test',record:{revision:0,pending:true,error:'Pendente para teste',commandId:'draft',data:{id:'draft',client:'Teste',unit:'Unidade',equipment:'Máquina',asset:'SL',hours:0,type:'Preventiva',priority:'Média',status:'Pendente',technicianId:'update-test',scheduled:'2026-11-04',parts:[],visits:[]}}});await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=reject});db.close();}''')
  authenticated['enabled']=True
  page.reload();expect(page.get_by_role('heading',name='Olá, Teste.')).to_be_visible()
  page.evaluate('window.releaseMarker="pending"')
  publish('c');page.evaluate('navigator.serviceWorker.getRegistration().then(r=>r.update())')
  expect(page.get_by_text('Nova versão pronta.',exact=False)).to_be_visible(timeout=15000)
  page.wait_for_timeout(2500)
  assert page.evaluate('window.releaseMarker')=='pending'
  # Another tab can activate a release: this tab must still defer its reload.
  page.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.waiting.postMessage({type:'ACTIVATE_UPDATE'}))")
  page.wait_for_timeout(2500)
  assert page.evaluate('window.releaseMarker')=='pending'
  assert page.get_by_text('1 pendente',exact=True).is_visible()
  assert not errors,errors
  print('PASS PWA: initial install, release detection, idle automatic reload, focused input deferral, pending IndexedDB draft and cross-tab activation protection.')
  browser.close()
 server.shutdown();server.server_close()
