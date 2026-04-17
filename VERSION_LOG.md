# DragFire Version Log

## [1.6.0] - 2026-04-17
### Adições
- **Assistente de Curvas (Alta Precisão)**: Implementação de análise cumulativa de curvas com janela de varredura de 60m.
- **Detecção de Via**: Agora o HUD exibe o nome da rua ou rodovia atual (via Overpass e Google Maps).
- **Rota Detalhada**: Integração com polilinhas detalhadas do Google Maps para maior precisão em traçados sinuosos.

### Fixes
- **Recursos**: Otimizado o consumo de RAM do Gradle para evitar desligamentos do sistema durante o build.
- **Direção**: Corrigida a inversão da lógica de curvas (Direita/Esquerda).
- **Estabilidade**: Sincronização de versões em todo o projeto.

## [1.3.4] - 2026-04-15
### Fixes
- **Conectividade**: Implementado "Reset Agressivo" de rede (disable/enableNetwork) para forçar o Firestore a sair do estado "offline" no Android.
- **Diagnóstico**: Novos passos 1.05 e 1.06 adicionados para monitorar o tranco de rede.

## [1.3.3] - 2026-04-15
### Fixes
- **Sintaxe**: Corrigido erro estrutural no `handleLogin` que impedia o funcionamento dos alertas.
- **Diagnóstico**: Alertas de Passo 0, 1 e 1.1 restaurados e funcionais.

## [1.3.2] - 2026-04-15
### Debug
- **Diagnóstico**: Reativados os alertas (Passo 0, 1, 1.1) para depurar o travamento no APK v1.3.x.

## [1.3.1] - 2026-04-15
### Fixes
- **Auth**: Revertida a chave de API para resolver o erro "network-request-failed".
- **Firestore**: Mantida a conectividade estável via Long Polling.

## [1.3.0] - 2026-04-15 (STABLE)
### Fixes
- **Firestore Connectivity**: Resolvido o erro "client is offline" no Android usando `experimentalForceLongPolling`.
- **Estabilização**: Removidos todos os alertas de debug e estabilizado o fluxo de login final.

## [1.2.9] - 2026-04-15
### Fixes & Debug
- **Firestore**: Adicionados micro-alertas (1.1, 1.2, 1.3) e forçada a leitura via rede (`getDocFromServer`) para diagnosticar o travamento no APK.

## [1.2.8] - 2026-04-15
### Fixes & Debug
- **Configuração**: Sincronizada a chave de API (Google Auth) entre o Web e o Android Nativo.
- **Diagnóstico**: Adicionados alertas visuais no processo de login para identificar bloqueios no APK.

## [1.2.7] - 2026-04-15
### Fixes
- **Auth Flow**: Estabilizado o listener de autenticação para evitar reinicializações durante a troca de conta.
- **Transição**: Garantida a transição de tela após a sincronização do perfil no Firestore.

## [1.2.6] - 2026-04-15
### Fixes
- **Login Google**: Removido código duplicado e estabilizado o reset do estado "Entrando...".
- **Limpeza**: Removidos hooks redundantes de teste de conexão.

## [1.2.5] - 2026-04-15
### Fixes
- **Firebase**: Corrigido erro de referência `updateDoc` no módulo de Termos do App.tsx.

## [1.2.4] - 2026-04-15
### UI/UX
- **Localização de Versão**: Removido o número da versão do cabeçalho de busca de postos.
- **Configurações**: Corrigido o local correto da versão dentro do menu de configurações, integrando com o sistema de versões dinâmicas.

## [1.2.3] - 2026-04-15
### UI/UX
- **Dica de Precisão**: Removido bloco estático que atrapalhava o layout. Agora a dica aparece como um overlay temporário que some após 5 segundos ou ao clicar em "Entendi".

## [1.2.2] - 2026-04-15
### Fixes (Postos de Combustível)
- **Ordenação Reativa**: Corrigido bug onde a lista não ordenava automaticamente ao carregar. Agora o cálculo de distância é imediato.
- **Exibição de Distância**: Resolvido problema do texto "Localização..." aparecendo indevidamente.
- **Header UI**: Melhorada a separação entre nome da cidade e versão do app para evitar confusão visual.

## [1.2.1] - 2026-04-15
### Adições (Telemetria)
- **Calibração de Fusão**: Adicionado controle de peso entre GPS e Acelerômetro no Painel Admin.
- **Ganho de Aceleração**: Multiplicador configurável para sensibilidade de arrancada.
- **Trava de Rotação (Rotation Lock)**: Filtro via Giroscópio para ignorar acelerações falsas causadas por girar o celular.
- **Smart Axis Lock**: Detecção automática do eixo de movimento no momento da arrancada.
- **Dica de Precisão**: Adicionada mensagem de orientação na tela de preparação do teste.

### Fixes
- **Correção de "Efeito Wrist"**: Rotações rápidas do pulso não aumentam mais a velocidade virtual.

## [1.2.0] - 2026-04-15
### Fixes
- **Busca de Postos**: Corrigido bug que "travava" a busca em Brodowski.
- **Desacoplamento**: A detecção do nome da cidade agora funciona de forma independente da busca por coordenadas GPS.
- **GPS Prioritário**: O sistema agora prioriza coordenadas exatas antes de tentar busca por texto.

### Mudanças Técnicas
- Removido `currentCity` como dependência obrigatória no efeito principal de carregamento de postos.
- Refinado `getCityFromCoordinates` para evitar detecções incorretas ou incompletas.
- Adicionado sistema de rastreamento de versão em `src/versions.ts`.

---

## [1.1.0] - 2026-04-14
### Adições
- Implementação inicial do Google Places API v1 (SearchNearby).
- Integração com base de dados ANP local.
- Suporte a raio de busca customizado (10km, 25km, 50km).
