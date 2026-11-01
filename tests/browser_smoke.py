"""Optional browser checks: pip install playwright; SOBERANIA_URL=http://127.0.0.1:5173 python3 tests/browser_smoke.py."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get('SOBERANIA_URL', 'http://127.0.0.1:5173')
ARTIFACTS = Path('test-results')
ARTIFACTS.mkdir(exist_ok=True)
SAVE_KEY = 'soberania.save.v1'

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1050}, device_scale_factor=1)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(URL, wait_until='networkidle')
    expect(page.get_by_role('heading', name='O futuro está nas suas mãos.')).to_be_visible()
    expect(page.locator('.country-shape')).to_have_count(177)
    page.screenshot(path=str(ARTIFACTS / 'dashboard-desktop.png'), full_page=True)
    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')

    def state():
        return page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', SAVE_KEY)

    def navigate(label):
        page.get_by_role('navigation', name='Navegação principal').get_by_role('button', name=label, exact=True).click()

    # Urgent choices do not consume one of the three regular decisions.
    page.get_by_role('button', name='Analisar situação').click()
    expect(page.get_by_role('dialog')).to_be_visible()
    page.get_by_role('button', name='Mobilizar auxílio emergencial').click()
    expect(page.get_by_role('dialog')).to_have_count(0)
    assert state()['event'] is None and state()['actions'] == 3
    assert state()['metrics']['approval'] == 62

    # Preview and confirm a free-text policy.
    page.get_by_role('button', name='Tomar uma decisão').click()
    page.get_by_role('button', name='Escrever uma proposta').click()
    page.get_by_label('Escreva a medida que você quer propor').fill('Ampliar o atendimento nos hospitais e reforçar a saúde pública.')
    page.get_by_role('button', name='Analisar proposta').click()
    expect(page.get_by_role('heading', name='Saúde perto de casa')).to_be_visible()
    page.get_by_role('button', name='Implementar medida').click()
    assert 'health' in state()['enacted'] and state()['actions'] == 2

    # Construction is funded now, but completed in later turns.
    navigate('Desenvolvimento')
    page.locator('.project-card').filter(has=page.get_by_role('heading', name='Rede de escolas técnicas')).get_by_role('button').click()
    assert state()['projects'][0]['type'] == 'school'

    # Research occupies an available slot and advances with time.
    navigate('Ciência e futuro')
    page.get_by_role('textbox', name='Buscar pesquisas').fill('programa espacial')
    expect(page.locator('.research-card')).to_have_count(1)
    page.locator('.research-card').get_by_role('button').click()
    assert state()['studies'][0]['type'] == 'space' and state()['actions'] == 0
    page.get_by_role('button', name='Avançar mês').click()
    assert state()['month'] == 1 and state()['actions'] == 3
    assert state()['projects'][0]['remaining'] == 2
    assert state()['studies'][0]['remaining'] == 2

    # Fiscal controls reject unbalanced allocations.
    navigate('Economia')
    page.locator('#tax').fill('34')
    page.locator('#budget-health').fill('25')
    expect(page.get_by_role('button', name='Aplicar política econômica')).to_be_disabled()
    page.locator('#budget-education').fill('21')
    page.get_by_role('button', name='Aplicar política econômica').click()
    assert state()['tax'] == 34 and state()['budget']['health'] == 25

    # Negotiation changes the expected coalition.
    navigate('Congresso')
    before = state()['parties'][0]['relation']
    page.get_by_role('row').filter(has_text='Aliança Nacional').get_by_role('button', name='Negociar', exact=True).click()
    assert state()['parties'][0]['relation'] == before + 14
    page.screenshot(path=str(ARTIFACTS / 'congress-desktop.png'), full_page=True)

    # Diplomatic missions modify a selected relationship.
    navigate('Diplomacia')
    page.get_by_label('SELECIONE UM PAÍS', exact=True).select_option('032')
    relation_before = state()['relations']['032']['score']
    page.get_by_role('button', name='Missão diplomática').click()
    assert state()['relations']['032']['score'] == min(100, relation_before + 12)

    # Persistence survives reload and all views render without runtime errors.
    saved = state()
    page.reload(wait_until='networkidle')
    assert state() == saved
    for nav in ['Gabinete', 'Economia', 'Congresso', 'Desenvolvimento', 'Diplomacia', 'Defesa e inteligência', 'Ciência e futuro', 'Central de notícias', 'Meu legado', 'Visão geral']:
        navigate(nav)
        expect(page.locator('h1')).to_be_visible()
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), nav

    # New government is explicit; name is rendered as text, including HTML-looking input.
    page.get_by_role('button', name='Gerenciar partida').click()
    page.get_by_role('button', name='Começar novo governo').click()
    page.get_by_label('Como devemos chamar você?').fill('Governo de teste')
    page.locator('.country-option').filter(has_text='Portugal').click()
    page.get_by_role('button', name='Tomar posse').click()
    assert state()['country'] == '620' and state()['month'] == 0
    assert state()['name'] == 'Governo de teste'

    # Export and import round trip, with replacement confirmation.
    page.get_by_role('button', name='Gerenciar partida').click()
    with page.expect_download() as download_info:
        page.get_by_role('button', name='Exportar partida', exact=True).click()
    download = download_info.value
    file_path = ARTIFACTS / download.suggested_filename
    download.save_as(str(file_path))
    assert json.loads(file_path.read_text())['country'] == '620'
    page.get_by_role('button', name='Fechar janela').click()
    page.get_by_label('Importar salvamento').set_input_files(str(file_path))
    expect(page.get_by_role('heading', name='Continuar esta história?')).to_be_visible()
    page.get_by_role('button', name='Carregar partida').click()
    assert state()['country'] == '620'

    # Narrow layouts, navigation, modal keyboard behavior, and overflow.
    mobile = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
    phone = mobile.new_page()
    phone.on('pageerror', lambda error: errors.append(str(error)))
    phone.goto(URL, wait_until='networkidle')
    phone.screenshot(path=str(ARTIFACTS / 'dashboard-mobile.png'), full_page=True)
    for nav in ['Gabinete', 'Economia', 'Congresso', 'Desenvolvimento', 'Diplomacia', 'Defesa e inteligência', 'Ciência e futuro', 'Central de notícias', 'Meu legado', 'Visão geral']:
        phone.get_by_role('button', name='Abrir menu').click()
        phone.get_by_role('navigation').get_by_role('button', name=nav, exact=True).click()
        expect(phone.locator('h1')).to_be_visible()
        assert not phone.evaluate('document.documentElement.scrollWidth > innerWidth'), f'mobile overflow: {nav}'
    phone.get_by_role('button', name='Tomar uma decisão').click()
    expect(phone.get_by_role('dialog')).to_be_visible()
    phone.keyboard.press('Escape')
    expect(phone.get_by_role('dialog')).to_have_count(0)
    assert phone.evaluate("document.activeElement.textContent.includes('Tomar uma decisão')")
    phone.set_viewport_size({'width': 360, 'height': 800})
    assert not phone.evaluate('document.documentElement.scrollWidth > innerWidth')
    assert not errors, errors
    print('PASS: desktop and mobile; 10 views; crisis, policy, construction, research, fiscal controls, negotiation, diplomacy, persistence, new game, export/import, modal keyboard controls; 0 browser errors.')
    browser.close()
