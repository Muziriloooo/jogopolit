"""Two browser origins: localhost and insecure HTTP phone; isolated local test relay."""
import http.client,os,shutil,socket,subprocess,tempfile,time,uuid
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
PORT=5188
LAN=os.environ.get('SL_LAN_HOST','192.0.2.10')
ORDER='E2E-LAN-'+uuid.uuid4().hex[:8]
with tempfile.TemporaryDirectory() as tmp:
 folder=Path(tmp)
 for name in ['src','server','public','tooling','shared']:
  shutil.copytree(ROOT/name,folder/name)
 for name in ['package.json','package-lock.json','vite.config.ts','index.html','tsconfig.json']:
  shutil.copy(ROOT/name,folder/name)
 (folder/'node_modules').symlink_to(ROOT/'node_modules',target_is_directory=True)
 output=open(folder/'vite.log','w+')
 process=subprocess.Popen(['node',str(ROOT/'node_modules/vite/bin/vite.js'),'--host','0.0.0.0','--port',str(PORT),'--strictPort'],cwd=folder,stdout=output,stderr=subprocess.STDOUT)
 try:
  ready=False
  for _ in range(100):
   try:
    conn=http.client.HTTPConnection('127.0.0.1',PORT,timeout=1);conn.request('GET','/__sl/version');response=conn.getresponse();response.read();conn.close()
    if response.status==200:ready=True;break
   except OSError:pass
   if process.poll() is not None:break
   time.sleep(.2)
  if not ready:
   output.seek(0);raise AssertionError(output.read())
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
   desktop=browser.new_context(viewport={'width':1440,'height':1000});mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
   # The managed cloud proxy denies direct LAN IP traffic. Relay this reserved
   # test address to the isolated loopback server; the browser still uses a real
   # insecure HTTP origin (no randomUUID/service worker). Never contact a user's PC.
   if not os.environ.get('SL_LAN_DIRECT'):
    prefix=f'http://{LAN}:{PORT}'
    mobile.route(prefix+'/**',lambda route:route.abort() if route.request.url.endswith('/api/events') else route.fulfill(response=route.fetch(url=route.request.url.replace(prefix,f'http://127.0.0.1:{PORT}',1))))
   computer=desktop.new_page();phone=mobile.new_page();errors=[]
   for page in [computer,phone]:page.on('pageerror',lambda e:(errors.append(str(e)),print('JS ERROR:',str(e))))
   def login(page,url,email):
    response=page.goto(url);print('Origin',url,'HTTP',response.status);page.get_by_label('E-mail corporativo').fill(email);page.get_by_label('Senha',exact=True).fill('Campo-demo-2026!');page.get_by_role('button',name='Entrar no SL Campo').click();expect(page.get_by_role('heading',name='Olá,')).to_be_visible();expect(page.get_by_text('Shopping Maia',exact=True).first).to_be_visible(timeout=20000)
   login(computer,f'http://127.0.0.1:{PORT}','admin@slcampo.local')
   login(phone,f'http://{LAN}:{PORT}','tecnico@slcampo.local')
   assert phone.evaluate('window.isSecureContext') is False
   assert phone.evaluate('typeof crypto.randomUUID')=='undefined'
   computer.get_by_role('button',name='Nova ordem de serviço').click()
   for label,value in [('Número da OS *',ORDER),('Cliente *','Cliente LAN'),('Unidade *','Unidade LAN'),('Equipamento *','Lavadora LAN')]:computer.get_by_label(label,exact=True).fill(value)
   computer.get_by_label('Nome do técnico (opcional)',exact=True).fill('Lucas Ferreira');computer.get_by_role('button',name='Criar ordem de serviço').click()
   expect(phone.get_by_role('button',name=ORDER)).to_be_visible(timeout=25000)
   phone.get_by_role('button',name=ORDER).click();phone.get_by_role('button',name='INICIAR ATENDIMENTO',exact=True).click();expect(phone.get_by_text('Check-in registrado',exact=True)).to_be_visible()
   phone.get_by_role('button',name='Continuar',exact=True).click();phone.get_by_label('Diagnóstico técnico *',exact=True).fill('Laudo LAN preservado')
   # Data must also reach the desktop while both pages stay open.
   expect(computer.get_by_text('Visita 1 · Em andamento',exact=True)).to_be_visible(timeout=10000)
   computer.locator('.detail-tabs').get_by_role('button',name='Atendimento',exact=True).click()
   computer.get_by_role('button',name='Continuar',exact=True).click()
   expect(computer.get_by_label('Diagnóstico técnico *',exact=True)).to_have_value('Laudo LAN preservado',timeout=10000)
   computer.get_by_label('Verificações mecânicas e resultados',exact=True).fill('Atualização do computador pela API')
   expect(phone.get_by_label('Verificações mecânicas e resultados',exact=True)).to_have_value('Atualização do computador pela API',timeout=10000)
   computer.locator('.detail-tabs').get_by_role('button',name='Resumo',exact=True).click()
   phone.evaluate('window.lanMarker="active-visit"');computer.evaluate('window.lanMarker="desktop"')
   # A change to the source on the computer is served automatically to both origins.
   (folder/'src/main.tsx').write_text((folder/'src/main.tsx').read_text()+'\n/* LAN release test */\n')
   computer.get_by_role('button',name='Voltar para as ordens').click();computer.get_by_role('heading',name='Olá,').click()
   computer.wait_for_function('window.lanMarker===undefined',timeout=15000)
   expect(phone.get_by_text('Nova versão pronta.',exact=False)).to_be_visible(timeout=15000)
   assert phone.evaluate('window.lanMarker')=='active-visit'
   expect(phone.get_by_label('Diagnóstico técnico *',exact=True)).to_have_value('Laudo LAN preservado')
   expect(phone.get_by_text('Sincronizado',exact=True)).to_be_visible(timeout=20000)
   # Leave the active form; reload now is safe and automatically fetches new code.
   phone.get_by_role('button',name='Voltar para as ordens').click();phone.get_by_role('heading',name='Olá,').click()
   phone.wait_for_function('window.lanMarker===undefined',timeout=15000)
   phone.get_by_role('button',name=ORDER).click();phone.get_by_role('button',name='Continuar atendimento').click();phone.get_by_role('button',name='Continuar',exact=True).click()
   expect(phone.get_by_label('Diagnóstico técnico *',exact=True)).to_have_value('Laudo LAN preservado')
   assert not errors,errors
   print('PASS LAN: insecure HTTP phone UUID/check-in, desktop-to-phone OS sync, source update on both origins, deferred reload and preserved draft.')
   browser.close()
 finally:
  process.terminate()
  try:process.wait(timeout=10)
  except subprocess.TimeoutExpired:process.kill();process.wait()
  output.close()
