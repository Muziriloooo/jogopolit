"""Real two-device data flow: no refresh, then offline reconciliation + polling fallback."""
import os,time,uuid
from playwright.sync_api import sync_playwright,expect
URL=os.environ.get('SL_URL','http://127.0.0.1:5173')
ORDER='E2E-LIVE-'+uuid.uuid4().hex[:8]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 desktop=browser.new_context(viewport={'width':1440,'height':1000});mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 computer=desktop.new_page();phone=mobile.new_page();errors=[]
 for page in [computer,phone]:page.on('pageerror',lambda e:errors.append(str(e)))
 def login(page,email):
  page.goto(URL);page.get_by_label('E-mail corporativo').fill(email);page.get_by_label('Senha',exact=True).fill('Campo-demo-2026!');page.get_by_role('button',name='Entrar no SL Campo').click();expect(page.get_by_text('Shopping Maia',exact=True).first).to_be_visible(timeout=20000);expect(page.get_by_text('Atualizações em tempo real',exact=False)).to_be_visible(timeout=10000)
 login(computer,'admin@slcampo.local');login(phone,'tecnico@slcampo.local')
 computer.get_by_role('button',name='Nova ordem de serviço').click()
 for label,value in [('Número da OS *',ORDER),('Cliente *','Cliente tempo real'),('Unidade *','Unidade tempo real'),('Equipamento *','Lavadora tempo real')]:computer.get_by_label(label,exact=True).fill(value)
 computer.get_by_label('Nome do técnico *',exact=True).fill('Lucas Ferreira');computer.get_by_role('button',name='Criar ordem de serviço').click()
 expect(phone.get_by_role('button',name=ORDER)).to_be_visible(timeout=6000)
 phone.get_by_role('button',name=ORDER).click();phone.get_by_role('button',name='INICIAR ATENDIMENTO',exact=True).click()
 expect(computer.get_by_text('Visita 1 · Em andamento',exact=True)).to_be_visible(timeout=6000)
 for page in [computer,phone]:page.locator('.detail-tabs').get_by_role('button',name='Atendimento',exact=True).click();page.get_by_role('button',name='Continuar',exact=True).click()
 phone.get_by_label('Diagnóstico técnico *',exact=True).fill('Diagnóstico do celular em tempo real')
 expect(computer.get_by_label('Diagnóstico técnico *',exact=True)).to_have_value('Diagnóstico do celular em tempo real',timeout=6000)
 computer.get_by_label('Verificações mecânicas e resultados',exact=True).fill('Teste mecânico registrado no computador')
 expect(phone.get_by_label('Verificações mecânicas e resultados',exact=True)).to_have_value('Teste mecânico registrado no computador',timeout=6000)
 expect(phone.get_by_text('Sincronizado',exact=True)).to_be_visible(timeout=10000)
 # Phone edits while offline; desktop edits a different field. Reconcile on reconnect.
 mobile.set_offline(True)
 phone.get_by_label('Diagnóstico técnico *',exact=True).fill('Diagnóstico preservado durante queda de rede')
 computer.get_by_label('Verificações mecânicas e resultados',exact=True).fill('Teste atualizado enquanto celular estava offline')
 for _ in range(60):
  rows=desktop.request.get(URL+'/api/orders').json();record=next(r for r in rows if r['data']['id']==ORDER)
  if record['data']['visits'][0]['mechanical']=='Teste atualizado enquanto celular estava offline':break
  time.sleep(.1)
 else:raise AssertionError('Edição do computador não foi enviada')
 # Deliberately block the live channel: polling must still recover both directions.
 mobile.route('**/api/events',lambda route:route.abort())
 mobile.set_offline(False)
 expect(phone.get_by_label('Verificações mecânicas e resultados',exact=True)).to_have_value('Teste atualizado enquanto celular estava offline',timeout=15000)
 expect(computer.get_by_label('Diagnóstico técnico *',exact=True)).to_have_value('Diagnóstico preservado durante queda de rede',timeout=15000)
 expect(phone.get_by_label('Diagnóstico técnico *',exact=True)).to_have_value('Diagnóstico preservado durante queda de rede')
 expect(phone.get_by_text('Sincronizado',exact=True)).to_be_visible(timeout=15000)
 rows=desktop.request.get(URL+'/api/orders').json();record=next(r for r in rows if r['data']['id']==ORDER);assert len(record['data']['visits'])==1
 # A hung HTTP request now aborts rather than permanently holding the sync lock.
 pending=[];phone.route('**/api/health?timeout-test=1',lambda route:pending.append(route))
 message=phone.evaluate("async()=>{const m=await import('/src/store.ts');try{await m.api('/health?timeout-test=1',{timeoutMs:100});return 'unexpected';}catch(e){return e.message}}")
 assert 'demorou' in message,message
 for route in pending:
  try:route.abort()
  except Exception:pass
 phone.unroute_all(behavior='wait')
 assert not errors,errors
 print('PASS: desktop → celular e celular → desktop sem recarregar; canal ao vivo; reconciliação offline de campos diferentes; fallback sem SSE; uma visita sem duplicação; timeout HTTP.')
 browser.close()
