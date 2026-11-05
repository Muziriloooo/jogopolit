"""Regression of the screenshots: offline first upload, legacy draft recovery, one admin, deletion."""
import json,os,uuid
from playwright.sync_api import sync_playwright,expect
URL=os.environ.get('SL_URL','http://127.0.0.1:5192')
ORDER='E2E-REQUEST-'+uuid.uuid4().hex[:8]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(URL);expect(page.get_by_role('heading',name='Vamos ao trabalho?')).to_be_visible()
 # Seed a pending draft into the OLD administrative account's IndexedDB.
 draft={'id':ORDER,'supplierOrder':'','client':'Cliente recuperação','unit':'Unidade recuperação','address':'','equipment':'Lavadora','brand':'','model':'','serial':'','asset':'','hours':10,'type':'Preventiva','priority':'Média','status':'Em andamento','technicianId':'tec-demo','scheduled':'2026-11-05','createdAt':'2026-11-05T10:00:00.000Z','parts':[],'visits':[{'id':'visit-recovered','checkIn':'2026-11-05T10:01:00.000Z','hours':10,'defect':'Defeito preservado','diagnosis':'Laudo da conta anterior','services':'Inspeção','operational':True,'misuse':False,'misuseNotes':'','returnNeeded':False,'notes':'Não perder este laudo','mechanical':'','photos':[],'signature':None,'signatureReason':'','signer':'','signerRole':'','signatureMode':'Assinada'}],'laborCents':0,'travelCents':0,'extraCents':0,'referenceNote':''}
 page.evaluate('''async draft=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('sl-campo',1);r.onsuccess=()=>resolve(r.result);r.onerror=reject});const tx=db.transaction(['meta','orders'],'readwrite');tx.objectStore('meta').put({id:'gest-demo',name:'Conta anterior',email:'gestor@slcampo.local',role:'gestor'},'user');tx.objectStore('orders').put({key:'gest-demo:'+draft.id,owner:'gest-demo',record:{data:draft,revision:0,pending:true,commandId:crypto.randomUUID(),error:'Nova OS deve começar pendente e sem visitas ou peças.'}});await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=reject});db.close()}''',draft)
 page.reload();expect(page.get_by_role('heading',name='Vamos ao trabalho?')).to_be_visible(timeout=20000)
 page.get_by_label('E-mail corporativo').fill('admin@slcampo.local');page.get_by_label('Senha',exact=True).fill('Campo-demo-2026!');page.get_by_role('button',name='Entrar no SL Campo').click()
 expect(page.get_by_role('heading',name='Olá, Administrador.')).to_be_visible(timeout=15000)
 expect(page.get_by_text('Sincronizado',exact=True)).to_be_visible(timeout=15000)
 rows=context.request.get(URL+'/api/orders').json();record=next(r for r in rows if r['data']['id']==ORDER)
 assert record['data']['visits'][0]['diagnosis']=='Laudo da conta anterior'
 assert len(record['data']['visits'])==1 and record['data']['status']=='Em andamento'
 page.get_by_role('button',name=ORDER).click();expect(page.get_by_role('button',name='Excluir atendimento',exact=True)).to_be_visible()
 page.locator('.detail-tabs').get_by_role('button',name='Atendimento',exact=True).click();page.get_by_role('button',name='Continuar',exact=True).click()
 assert page.get_by_label('Medições elétricas (V / A)',exact=True).count()==0
 assert page.get_by_label('Teste de bateria e resultado',exact=True).count()==0
 expect(page.get_by_label('Diagnóstico técnico *',exact=True)).to_have_value('Laudo da conta anterior')
 # Fresh OS is created + visit filled entirely offline before ANY server creation.
 page.get_by_role('button',name='Voltar para as ordens').click();mobile_id='E2E-OFFLINE-'+uuid.uuid4().hex[:8]
 context.set_offline(True);page.get_by_role('button',name='Nova ordem de serviço').click()
 for label,value in [('Número da OS *',mobile_id),('Cliente *','Cliente offline'),('Unidade *','Unidade offline'),('Equipamento *','Equipamento offline')]:page.get_by_label(label,exact=True).fill(value)
 page.get_by_role('button',name='Criar ordem de serviço').click();page.get_by_role('button',name='INICIAR ATENDIMENTO',exact=True).click();page.get_by_role('button',name='Continuar',exact=True).click()
 page.get_by_label('Qual o defeito relatado? *',exact=True).fill('Defeito offline');page.get_by_label('Diagnóstico técnico *',exact=True).fill('Diagnóstico offline completo');page.get_by_label('Quais serviços foram executados? *',exact=True).fill('Serviço offline')
 context.set_offline(False);expect(page.get_by_text('Sincronizado',exact=True)).to_be_visible(timeout=15000)
 record=next(r for r in context.request.get(URL+'/api/orders').json() if r['data']['id']==mobile_id);assert len(record['data']['visits'])==1
 # Adaptive image compression for existing drafts beyond the old schema limit.
 result=page.evaluate('''async()=>{const c=document.createElement('canvas');c.width=1600;c.height=1600;const ctx=c.getContext('2d');const pixels=ctx.createImageData(1600,1600);for(let i=0;i<pixels.data.length;i+=4){pixels.data[i]=Math.random()*256;pixels.data[i+1]=Math.random()*256;pixels.data[i+2]=Math.random()*256;pixels.data[i+3]=255}ctx.putImageData(pixels,0,0);const raw=c.toDataURL('image/jpeg',1);const {prepareOrderForSync}=await import('/src/store.ts');const next=await prepareOrderForSync({visits:[{photos:[{data:raw}],signature:null}]});return {before:raw.length,after:next.visits[0].photos[0].data.length}}''')
 assert result['before']>1600000 and result['after']<=1400000,result
 # Only administrator may delete: technician has neither UI button nor API permission.
 tech=browser.new_context();tp=tech.new_page();tp.goto(URL);tp.get_by_label('E-mail corporativo').fill('tecnico@slcampo.local');tp.get_by_label('Senha',exact=True).fill('Campo-demo-2026!');tp.get_by_role('button',name='Entrar no SL Campo').click();expect(tp.get_by_role('button',name=ORDER)).to_be_visible(timeout=15000);tp.get_by_role('button',name=ORDER).click();assert tp.get_by_role('button',name='Excluir atendimento',exact=True).count()==0;assert tech.request.delete(URL+'/api/orders/'+ORDER).status==403
 page.get_by_role('button',name='Voltar para as ordens').click();page.get_by_role('button',name=ORDER).click();page.on('dialog',lambda d:d.accept());page.get_by_role('button',name='Excluir atendimento',exact=True).click();expect(page.get_by_text('Atendimento #'+ORDER+' excluído.',exact=True)).to_be_visible(timeout=10000)
 expect(tp.locator('.detail-tabs')).to_have_count(0,timeout=10000)
 rows=context.request.get(URL+'/api/orders').json();assert all(r['data']['id']!=ORDER for r in rows);assert any(r['data']['id']==mobile_id for r in rows)
 assert not errors,errors
 print('PASS solicitações: rascunho antigo recuperado, OS nova iniciada offline sincronizada, campos removidos, foto grande comprimida, exclusão individual restrita ao administrador e propagada sem apagar outras OS.')
 browser.close()
