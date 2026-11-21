# Registo do Processo — Quadro Sinóptico 3D

## Decisão de Arquitetura e Âmbito
- **Metáfora escolhida:** Quadro sinóptico / subestação modular com 5 células, ligando a identidade de eletrotecnia e desenho técnico a projetos de engenharia informática, embebidos, IoT e produção musical.
- **Porque não usei modelos 3D externos nem mundos abertos complexos:** com disponibilidade limitada e necessidade de correr fluido num portátil comum dentro de um pacote `.zip` leve, optei por geometria procedural em Three.js r160, shaders GLSL próprios e Web Audio API. Priorizei três destaques técnicos explicáveis em vez de acumular vários projetos ou cenários pesados.

## O Que Correu Mal / Becoss Sem Saída
1. **Ecrã preto após ligar o `shaders.js`:** ao substituir `busMat` pelo `ShaderMaterial` no barramento principal, ficou uma referência solta a `busMat` na criação dos *risers* das células (`Uncaught ReferenceError: busMat is not defined`), interrompendo o script antes de iniciar o loop de animação. Corrigido mantendo `busMat` para os *risers* e usando `busShader.material` no barramento principal.
2. **Corte de texto nos ecrãs `CanvasTexture`:** os primeiros testes usavam `.slice(0, 28)` e uma única linha para títulos e *tags*, o que cortou títulos mais longos e a lista de tecnologias junto à margem direita. Substituí por cálculo dinâmico de largura (`measureText`) e quebra de linha controlada.
3. **Frequência de redesenho do `CanvasTexture` com FFT:** redesenhar uma textura de canvas a cada frame completo (60 FPS) durante a análise de áudio desperdiça tempo de CPU e largura de banda de upload de textura. Limitei a atualização visual da célula de áudio a intervalos (~75 ms) e defini um tamanho de janela FFT curto (`fftSize = 256`) para resposta rítmica rápida sem sobrecarregar o browser.
4. **Custo de `EdgesGeometry` e resolução em portáteis:** gerar arestas em todas as malhas e usar `devicePixelRatio` sem limite pode pesar em máquinas modestas; por isso adicionei um seletor de qualidade (*Baixa / Média / Alta*) e leitura direta de FPS, *frametime* e *draw calls* (`renderer.info.render.calls`).

## Próximos Passos Antes da Entrega (14 de dezembro)
- Colocar um excerto curto e leve da minha autoria em `assets/track.ogg` para validar a análise FFT ao vivo na Célula 05.
- Registar medições comparativas (FPS, ms/frame e *draw calls*) entre modos de qualidade e entre vista industrial e modo *Blueprint* para redigir as três notas técnicas de meia página.
- Gravar o vídeo de 60–90 segundos e testar o `.zip` limpo com o comando documentado no `README.md`.