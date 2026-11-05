from pathlib import Path
from reportlab.pdfgen import canvas


def make_internal_pdf(path, number, client='Cliente de teste', unit='Filial de teste', equipment='Lavadora de piso'):
    path = Path(path)
    document = canvas.Canvas(str(path))
    y = 800
    lines = [
        '# SOLICITAÇÃO FEITA PELO FORMULARIO:',
        '-------------------------------------------------------',
        'ABERTURA DA SOLICITAÇÃO: 05/11/2026 08:00:00',
        'NOME: RESPONSÁVEL DE TESTE',
        'TELEFONE: (11) 90000-0000',
        f'CLIENTE: {client}',
        f'FILIAL: {unit}',
        f'QUAL É O MAQUINÁRIO?: {equipment}',
        'MODELO: MODELO TESTE',
        'FABRICANTE: FABRICANTE TESTE',
        'DESCREVA O PROBLEMA DO MAQUINÁRIO: VAZAMENTO INFORMADO NO CHAMADO',
        'NUMERO DE SERIE: SERIE-TESTE',
        'ENDEREÇO DO CLIENTE: ENDEREÇO FICTÍCIO, 100',
        '-------------------------------------------------------',
        '# OBSERVAÇÕES PERFORMANCE:',
        'LEVAR OS EPIS NECESSÁRIOS PARA O ATENDIMENTO',
        '-------------------------------------------------------',
        '# INFORMAÇÕES DO PERFORMANCE:',
        f'Numero: {number}',
    ]
    for line in lines:
        document.drawString(45, y, line)
        y -= 24
    document.save()
    return path
