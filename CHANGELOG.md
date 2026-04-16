# Changelog - DragFire

## [v1.5.3] - 2026-04-16
### Adicionado
- **Sensor Fusion Equilibrado**: Reintroduzida a suavização via acelerômetro, mas com ganho reduzido (20%) e trava de segurança (Drift Guard) de 5 km/h. O ponteiro agora é fluido sem ser instável.

### Corrigido
- **Sincronização GPS**: Aumentado o peso do GPS para 95% para garantir que a velocidade final seja sempre a real do solo.
- **Redeclaração de Variável**: Corrigido bug interno que poderia causar erro em dispositivos específicos.

## [v1.5.2] - 2026-04-16
### Corrigido
- **Upload de Fotos**: Adicionadas permissões de Câmera e Armazenamento no Manifesto do Android. Agora as fotos podem ser capturadas e enviadas sem erro.
- **Estabilização do Velocímetro**: Removida a interpolação agressiva do acelerômetro na interface. A velocidade agora segue o GPS (estilo Waze), eliminando vibrações e saltos artificiais nos números.
- **Confiabilidade**: Velocímetro agora é 100% focado no deslocamento real, mantendo o acelerômetro apenas para o cronômetro interno.

## [v1.5.1] - 2026-04-16
### Adicionado
- **Câmera Nativa**: Integração com o plug-in nativo do Capacitor para fotos de veículos. Resolvido o problema de "travamento" no upload em aparelhos Android.

### Corrigido
- **Filtro de Velocidade Zero**: Velocímetro agora trava em 0 km/h enquanto o veículo está parado (Waiting/Ready), eliminando o ruído do sensor fusion.
- **Precisão de Largada**: Refinamento na detecção de arrancada (Motion Sensitivity) para ignorar vibrações de motor e melhorar a confiabilidade do timer.
- **Fusion Weight**: Ajuste no peso do GPS (85%) para garantir velocidades mais realistas durante a puxada.

## [v1.5.0] - 2026-04-16
### Adicionado
- **Seletor de Veículo no Teste**: Agora é possível escolher qual veículo está sendo testado diretamente na tela de Timer (canto superior esquerdo).
- **Vínculo de Puxada**: Todos os resultados de testes agora salvam o nome e ID do veículo utilizado.
- **Admin Dashboard**: Acesso direto às estatísticas de API no menu inferior (apenas para administradores).
- **Integração Instagram**: Campo de Instagram no perfil e link direto no perfil público.
- **Biblioteca de Veículos**: Perfil do usuário agora exibe todos os seus veículos cadastrados como um catálogo.

### Alterado
- **Reorganização de UI**: "Teste Turbo" renomeado para "Teste Performance".
- **Menu Performance**: Modos "Livre" e "Viagem" movidos para dentro do menu Performance para limpar a tela inicial.
- **Barra de Navegação**: Removidos itens menos usados (Feed e Postos) para uma interface mais limpa.
- **Status Premium**: Administradores agora possuem status Premium automático para testes.

### Corrigido
- **Black Screen Crash**: Corrigido erro de referência que causava tela preta após o login no Android.
- **Vehicle Save/Upload**: Corrigido bloqueio que impedia o salvamento de veículos e upload de fotos.
- **Auth Flow**: Otimização do fluxo de autenticação para evitar travamentos de rede no APK.

---

## [v1.4.0] - Pre-Release
- Integração básica com Firebase.
- Sistema de GPS e Sensor Fusion.
- Filtros de medição de performance.
