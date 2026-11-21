# Wish List — como colocar no ar

## 1. GitHub (o app)
1. Crie um repositório novo chamado **WishList** (público), igual ao Biblioteca.
2. Arraste para ele todos os arquivos desta pasta (pode incluir a pasta `supabase`).
3. Settings > Pages > Branch **main** / pasta **/(root)** > Save.
4. Em 1–2 minutos o app abre em **https://ronei-dotcom.github.io/WishList/**

## 2. Supabase — tabela (uma vez)
No mesmo projeto do Folio: **SQL Editor > New query**, cole o conteúdo de `supabase-setup.sql` e clique **Run**.
Isso cria só a tabela `wishlist`; nada do Folio é alterado.

## 3. Supabase — preenchimento automático (uma vez)
1. Menu **Edge Functions > Deploy a new function > Via Editor**.
2. Nome da função: **wish-preview** (exatamente assim).
3. Apague o código de exemplo e cole todo o conteúdo de `supabase/functions/wish-preview/index.ts`. Clique **Deploy**.
4. Depois de publicada, abra a função > **Details** e **desligue "Verify JWT"** (Enforce JWT verification). Salve.
   Sem isso o app recebe erro 401 e você preenche tudo à mão.

## Instalar no celular
Abra o link no celular > menu do navegador > **Adicionar à tela inicial**.
No Android, depois de instalado, o Wish List aparece no botão **Compartilhar** das lojas: compartilhou, ele já abre lendo o link.

## Observações
- Algumas lojas (Amazon, Mercado Livre) às vezes bloqueiam a leitura. Aí o app traz o que conseguir e você completa.
- No card, o botão ✓ marca como comprado; o lápis abre para editar, excluir ou **Atualizar dados** (busca o preço de novo).
- O total do topo soma só o que ainda não foi comprado, separado por moeda (R$, Gs, US$, €).
- Igual ao Folio, sem login: quem tiver o link do app consegue ver e mexer na lista.
