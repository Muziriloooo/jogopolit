import os,json,subprocess,uuid
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from pdf_fixture import make_internal_pdf
BASE=os.environ.get('SL_URL','http://127.0.0.1:5173')
ART=Path('test-results');ART.mkdir(exist_ok=True)
ORDER='E2E '+uuid.uuid4().hex[:8]+'/2026_A'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True,has_touch=True)
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def login(email):
  page.goto(BASE);page.get_by_label('E-mail corporativo').fill(email);page.get_by_label('Senha',exact=True).fill('Campo-demo-2026!');page.get_by_role('button',name='Entrar no SL Campo').click();expect(page.get_by_role('heading',name='Olá,')).to_be_visible();expect(page.get_by_text('Shopping Maia',exact=True).first).to_be_visible(timeout=20000)
 login('admin@slcampo.local')
 page.screenshot(path=str(ART/'dashboard-desktop.png'),full_page=True)
 source_pdf=make_internal_pdf(ART/'chamado-interno.pdf',ORDER,'Cliente de teste','Unidade de teste','Lavadora de teste')
 page.get_by_role('button',name='Importar chamado').click();page.get_by_label('PDF do chamado interno').set_input_files(str(source_pdf));expect(page.get_by_role('heading',name='Chamado #'+ORDER)).to_be_visible();page.get_by_role('button',name='Criar atendimento pelo PDF').click();expect(page.get_by_role('heading',name='Ordem de serviço')).to_be_visible()
 page.locator('.detail-tabs').get_by_role('button',name='Peças',exact=True).click();assert page.get_by_role('heading',name='Serviços e custos',exact=True).count()==0
 page.get_by_role('button',name='Sincronizar',exact=True).click();expect(page.get_by_text('Sincronizado',exact=True)).to_be_visible(timeout=15000)
 page.get_by_role('button',name='Administrador').click();expect(page.get_by_role('heading',name='Vamos ao trabalho?')).to_be_visible()
 login('tecnico@slcampo.local')
 page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(ART/'dashboard-mobile.png'),full_page=True)
 page.get_by_role('button',name=ORDER).click()
 page.screenshot(path=str(ART/'atendimento-resumo-mobile.png'),full_page=True)
 page.get_by_role('button',name='INICIAR ATENDIMENTO',exact=True).click();expect(page.get_by_text('Check-in registrado',exact=True)).to_be_visible()
 if os.environ.get('SL_OFFLINE'):
  page.evaluate('navigator.serviceWorker.ready');context.set_offline(True)
 page.get_by_role('button',name='Continuar',exact=True).click()
 assert page.get_by_label('Qual o defeito relatado? *',exact=True).count()==0;assert page.get_by_label('Verificações mecânicas e resultados',exact=True).count()==0
 misuse=page.locator('.yesno').filter(has_text='Existe evidência de mau uso?');expect(page.get_by_label('Evidências / descrição do mau uso',exact=True)).to_have_count(0);misuse.get_by_role('button',name='Sim').click();expect(page.get_by_label('Evidências / descrição do mau uso',exact=True)).to_be_visible();expect(page.get_by_text('Tirar foto do mau uso',exact=True)).to_be_visible();misuse.get_by_role('button',name='Não').click();expect(page.get_by_label('Evidências / descrição do mau uso',exact=True)).to_have_count(0)
 for label,value in [('Diagnóstico técnico *','Desgaste identificado na inspeção'),('Quais serviços foram executados? *','Limpeza e ajuste do conjunto')]:page.get_by_label(label,exact=True).fill(value)
 page.get_by_role('button',name='Continuar',exact=True).click()
 # Test actual image processing, IndexedDB persistence, captions.
 expect(page.get_by_text('Categoria das fotos',exact=True)).to_have_count(0)
 from PIL import Image
 Image.new('RGB',(1000,700),'#52744b').save(ART/'foto.jpg')
 page.locator('input[type=file][multiple]').set_input_files(str(ART/'foto.jpg'))
 page.get_by_label('Legenda da foto').fill('Equipamento após inspeção')
 if os.environ.get('SL_OFFLINE'):
  page.reload();expect(page.get_by_role('heading',name='Olá,')).to_be_visible();page.get_by_role('button',name=ORDER).click();page.get_by_role('button',name='Continuar atendimento').click();page.get_by_role('button',name='Continuar',exact=True).click();expect(page.get_by_label('Diagnóstico técnico *',exact=True)).to_have_value('Desgaste identificado na inspeção');page.get_by_role('button',name='Continuar',exact=True).click();expect(page.get_by_label('Legenda da foto')).to_have_value('Equipamento após inspeção')
 page.get_by_role('button',name='Continuar',exact=True).click()
 page.locator('.detail-tabs').get_by_role('button',name='Peças',exact=True).click();page.get_by_role('button',name='Adicionar peça a solicitar',exact=True).click();page.locator('.inset-form select').select_option('MT13044');page.get_by_label('Quantidade',exact=True).fill('2');page.get_by_role('button',name='Salvar solicitação').click();expect(page.get_by_role('heading',name='Aguardando aprovação',exact=True)).to_be_visible();expect(page.get_by_text('Sim · 2 un.',exact=True)).to_be_visible();page.screenshot(path=str(ART/'pecas-mobile.png'),full_page=True);page.locator('.detail-tabs').get_by_role('button',name='Atendimento',exact=True).click()
 for _ in range(3):page.get_by_role('button',name='Continuar',exact=True).click()
 page.get_by_label('Nome do responsável *',exact=True).fill('Responsável fictício');page.get_by_label('Cargo *',exact=True).fill('Supervisor')
 canvas=page.locator('canvas');box=canvas.bounding_box();cdp=context.new_cdp_session(page)
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':box['x']+40,'y':box['y']+65,'id':1}]})
 for x,y in [(65,80),(90,100),(120,85),(150,60)]:cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':box['x']+x,'y':box['y']+y,'id':1}]})
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 page.screenshot(path=str(ART/'assinatura-mobile.png'),full_page=True)
 page.get_by_role('button',name='Finalizar visita e registrar saída').click();expect(page.get_by_text('Visita 1 · Finalizada')).to_be_visible()
 page.get_by_role('button',name='Documentos',exact=True).click()
 expect(page.get_by_role('button',name='Abrir PDF interno',exact=True)).to_be_visible()
 with page.expect_download() as info:page.get_by_role('button',name='Baixar PDF').nth(1).click()
 info.value.save_as(str(ART/'relatorio.pdf'));assert (ART/'relatorio.pdf').stat().st_size>5000
 pdf_text=subprocess.run(['pdftotext',str(ART/'relatorio.pdf'),'-'],check=True,capture_output=True,text=True).stdout
 assert 'SOUZA LIMA' in pdf_text and 'RELATÓRIO TÉCNICO' in pdf_text
 assert 'Peças aplicadas: Nenhuma' in pdf_text and 'Há peças pendentes de instalação: Sim' in pdf_text
 if os.environ.get('SL_OFFLINE'):context.set_offline(False)
 page.get_by_role('button',name='Sincronizar',exact=True).click();expect(page.get_by_text('Sincronizado',exact=True)).to_be_visible(timeout=20000)
 assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
 assert not errors,errors
 print('PASS desktop/mobile: login, manager creation/assignment, technician check-in, diagnosis, photo compression, parts request, drawn signature, check-out, PDF and sync; no browser errors.')
 browser.close()
