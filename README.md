# Visitas de Obra

Aplicativo de celular (PWA) para o arquiteto controlar **visitas de obra**: checklist por etapa, fotos, pendências e relatório em PDF. Funciona **offline**, instala na tela inicial do iPhone e do Android e guarda tudo **no próprio aparelho** (IndexedDB). Não precisa de servidor, login nem internet depois do primeiro acesso.

## O que ele faz
- **Obras:** nome, cliente e endereço (criar, editar, excluir).
- **Visitas:** lista por data dentro de cada obra. A nova visita já nasce com data e hora de agora (editáveis), observações gerais, checklist e fotos.
- **Checklist:** 10 modelos prontos (Fundação, Estrutura, Alvenaria, Instalações elétricas, Instalações hidráulicas, Impermeabilização, Revestimentos, Pintura, Esquadrias, Limpeza). Cada item: *Conforme*, *Não conforme* ou *Não se aplica* + comentário. Dá para criar/editar/remover/reordenar itens e modelos (aba **Modelos**), e adicionar itens ou etapas soltos dentro da visita.
- **Fotos:** câmera ou galeria, várias por visita, com legenda e vínculo opcional a um item. São comprimidas (máx. 1600 px, JPEG 72%).
- **Pendências:** todo item *Não conforme* vira pendência da obra (aba Pendências), com status *Aberta/Resolvida* e prazo opcional (destaca vencidas).
- **Relatório:** cabeçalho da obra, data, resumo, checklist, pendências em aberto e fotos com legenda → **Salvar PDF / Imprimir** e **resumo por WhatsApp**.
- **Backup:** exportar/importar tudo (inclui fotos) em um arquivo `.json` (aba **Ajustes**).
- Tema claro/escuro/automático, azul-petróleo, botões grandes, tudo em português.

## Como usar (passo a passo)
1. Abra o app → **Nova obra** → preencha e salve.
2. Dentro da obra → **Nova visita** → marque as etapas que quer vistoriar → **Iniciar visita**.
3. Em cada item toque em ✓ Conforme / ✕ Não conforme / N/A. Comentário é opcional. Em *Não conforme* aparece o prazo e o botão de resolver.
4. Fotos: **Câmera** ou **Galeria**; toque na foto para legendar/vincular. O botão "📷 Foto deste item" já vincula a foto.
5. **Gerar relatório (PDF)** → "Salvar PDF / Imprimir":
   - Android: escolha *Salvar como PDF*, depois compartilhe o arquivo.
   - iPhone: na pré-visualização de impressão, toque em Compartilhar (ou pince a miniatura para abrir o PDF) e envie por WhatsApp/e-mail.
6. Tudo é salvo automaticamente.

## Como hospedar de graça (necessário uma vez, para poder instalar no celular)
PWAs exigem endereço **https**. Opções gratuitas (você mesmo faz; o app não publica nada sozinho):

**Netlify (mais fácil):** acesse app.netlify.com/drop, arraste a **pasta inteira** `visitas-de-obra` para a página. Ele gera um link `https://….netlify.app`.

**GitHub Pages:** crie um repositório no GitHub, envie os arquivos desta pasta (index.html, app.js, style.css, sw.js, manifest.webmanifest e a pasta icons), vá em *Settings → Pages* → *Deploy from a branch* → `main` / `(root)`. O link será `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

Abra o link no celular **uma vez com internet**; depois funciona offline.

## Como instalar
- **iPhone (Safari):** abra o link no **Safari** → botão Compartilhar → **Adicionar à Tela de Início** → Adicionar.
- **Android (Chrome):** abra o link → menu ⋮ → **Instalar app** (ou "Adicionar à tela inicial").

## Decisões tomadas
- Arquivos separados (`index.html`, `style.css`, `app.js`) em vez de um só, por organização; sem frameworks nem dependências.
- Cada visita guarda uma **cópia** dos itens do modelo; editar um modelo não muda visitas antigas.
- A lista de pendências é derivada dos itens *Não conforme* das visitas; se o item deixar de ser "Não conforme", a pendência some.
- O relatório lista as pendências **em aberto de toda a obra**, não só as da visita.
- Relatório em PDF usa a impressão do navegador (sem bibliotecas); o texto para WhatsApp é um resumo (WhatsApp não aceita anexo por link).
- Dados só no aparelho: limpar dados do navegador/desinstalar o app **apaga tudo**. Faça backup.

## Limitações / atenção
- Os dados **não sincronizam** entre aparelhos; use o backup para mover.
- No iPhone, o Safari pode apagar dados de sites não usados por ~7 dias *se o app não estiver instalado na tela inicial*; instalado, os dados ficam protegidos. Mesmo assim, faça backups.
- Importar backup **substitui** todos os dados atuais; backups com muitas fotos podem ser pesados.
- O app foi verificado por teste automatizado do fluxo principal (obras, visita, checklist, pendências, relatório, telas), mas não foi testado em aparelhos físicos nem a câmera; teste no seu celular antes de usar em campo.
- Para publicar uma nova versão, altere `CACHE` em `sw.js` (ex.: `v2`) para os celulares atualizarem.

## Arquivos
`index.html` · `style.css` · `app.js` · `sw.js` (offline) · `manifest.webmanifest` · `icons/` · `tools/gerar_icones.py` (regera os ícones: `python tools/gerar_icones.py`).
