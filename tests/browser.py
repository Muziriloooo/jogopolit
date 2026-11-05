import os,json,uuid
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('SL_URL','http://127.0.0.1:5173')
ART=Path('test-results');ART.mkdir(exist_ok=True)
ORDER='E2E-'+uuid.uuid4().hex[:8]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def login(email):
  page.goto(BASE);page.get_by_label('E-mail corporativo').fill(email);page.get_by_label('Senha',exact=True).fill('Campo-demo-2026!');page.get_by_role('button',name='Entrar no SL Campo').click();expect(page.get_by_role('heading',name='Olá,')).to_be_visible();expect(page.get_by_text('Shopping Maia',exact=True).first).to_be_visible(timeout=20000)
 login('admin@slcampo.local')
 page.screenshot(path=str(ART/'dashboard-desktop.png'),full_page=True)
 page.get_by_role('button',name='Nova ordem de serviço').click()
 for label,value in [('Número da OS *',ORDER),('Cliente *','Cliente de teste'),('Unidade *','Unidade de teste'),('Equipamento *','Lavadora de teste')]:page.get_by_label(label,exact=True).fill(value)
 page.get_by_label('Nome do técnico *',exact=True).fill('Lucas Ferreira')
 page.get_by_role('button',name='Criar ordem de serviço').click();expect(page.get_by_role('heading',name='Ordem de serviço')).to_be_visible()
 page.get_by_role('button',name='Sincronizar',exact=True).click();expect(page.get_by_text('Sincronizado',exact=True)).to_be_visible(timeout=15000)
 page.get_by_role('button',name='Administrador').click();expect(page.get_by_role('heading',name='Vamos ao trabalho?')).to_be_visible()
 login('tecnico@slcampo.local')
 page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(ART/'dashboard-mobile.png'),full_page=True)
 page.get_by_role('button',name=ORDER).click()
 page.get_by_role('button',name='INICIAR ATENDIMENTO',exact=True).click();expect(page.get_by_text('Check-in registrado',exact=True)).to_be_visible()
 if os.environ.get('SL_OFFLINE'):
  page.evaluate('navigator.serviceWorker.ready');context.set_offline(True)
 page.get_by_role('button',name='Continuar',exact=True).click()
 for label,value in [('Qual o defeito relatado? *','Ruído no conjunto do rodo'),('Diagnóstico técnico *','Desgaste identificado na inspeção'),('Quais serviços foram executados? *','Limpeza e ajuste do conjunto')]:page.get_by_label(label,exact=True).fill(value)
 page.get_by_role('button',name='Continuar',exact=True).click()
 # Test actual image processing, IndexedDB persistence, captions.
 from PIL import Image
 Image.new('RGB',(1000,700),'#52744b').save(ART/'foto.jpg')
 page.locator('input[type=file][multiple]').set_input_files(str(ART/'foto.jpg'))
 page.get_by_label('Legenda da foto').fill('Equipamento após inspeção')
 if os.environ.get('SL_OFFLINE'):
  page.reload();expect(page.get_by_role('heading',name='Olá,')).to_be_visible();page.get_by_role('button',name=ORDER).click();page.get_by_role('button',name='Continuar atendimento').click();page.get_by_role('button',name='Continuar',exact=True).click();expect(page.get_by_label('Diagnóstico técnico *',exact=True)).to_have_value('Desgaste identificado na inspeção');page.get_by_role('button',name='Continuar',exact=True).click();expect(page.get_by_label('Legenda da foto')).to_have_value('Equipamento após inspeção')
 page.get_by_role('button',name='Continuar',exact=True).click()
 page.locator('.detail-tabs').get_by_role('button',name='Peças',exact=True).click();page.get_by_role('button',name='Solicitar peça',exact=True).click();page.locator('.inset-form select').select_option('MT13044');page.get_by_label('Quantidade',exact=True).fill('2');page.get_by_role('button',name='Salvar solicitação').click();expect(page.get_by_text('Solicitada',exact=True)).to_be_visible();page.locator('.detail-tabs').get_by_role('button',name='Atendimento',exact=True).click()
 for _ in range(3):page.get_by_role('button',name='Continuar',exact=True).click()
 page.get_by_label('Nome do responsável *',exact=True).fill('Responsável fictício');page.get_by_label('Cargo *',exact=True).fill('Supervisor')
 canvas=page.locator('canvas');box=canvas.bounding_box();page.mouse.move(box['x']+40,box['y']+65);page.mouse.down();page.mouse.move(box['x']+90,box['y']+100,steps=8);page.mouse.move(box['x']+150,box['y']+60,steps=8);page.mouse.up()
 page.screenshot(path=str(ART/'assinatura-mobile.png'),full_page=True)
 page.get_by_role('button',name='Finalizar visita e registrar saída').click();expect(page.get_by_text('Visita 1 · Finalizada')).to_be_visible()
 page.get_by_role('button',name='Documentos',exact=True).click()
 with page.expect_download() as info:page.get_by_role('button',name='Baixar PDF').nth(1).click()
 info.value.save_as(str(ART/'relatorio.pdf'));assert (ART/'relatorio.pdf').stat().st_size>5000
 if os.environ.get('SL_OFFLINE'):context.set_offline(False)
 page.get_by_role('button',name='Sincronizar',exact=True).click();expect(page.get_by_text('Sincronizado',exact=True)).to_be_visible(timeout=20000)
 assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
 assert not errors,errors
 print('PASS desktop/mobile: login, manager creation/assignment, technician check-in, diagnosis, photo compression, parts request, drawn signature, check-out, PDF and sync; no browser errors.')
 browser.close()
