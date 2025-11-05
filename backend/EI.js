// ========== VARIÁVEIS GLOBAIS ==========
let mapa;
let todosRelatos = [];
let userLocation = null;
let userBairro = null;
let userCidade = null;
const OPENWEATHER_API_KEY = 'f5388f8c9779d967c66b9a183cbc3eb4';
let foodSecurityChart = null;
let graficoProblemasEstado = null;

// ========== CONFIGURAÇÃO DO BANCO DE DADOS JSONBIN.IO ==========
// SUBSTITUA estas variáveis com suas credenciais do JSONBin.io
const JSONBIN_API_KEY = '$2a$10$eU6Mxfif5B/C4sTyAO/Ns.n8vC9QiLufRRe8cSrQ2ZpG9FbyE4B9a'; // MINHA X-Master-Key do JSONBin
const JSONBIN_BIN_ID = '690b77d7ae596e708f46a389'; // MEU Bin ID do JSONBin
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

// ========== FUNÇÕES DO BANCO DE DADOS ==========

// Carregar todos os relatos do banco de dados
async function carregarRelatosDoBanco() {
    try {
        const response = await fetch(JSONBIN_URL + '/latest', {
            method: 'GET',
            headers: {
                'X-Master-Key': JSONBIN_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao carregar relatos do banco de dados');
        }

        const data = await response.json();
        
        // Se não existirem relatos no banco, retorna array vazio
        if (data.record && Array.isArray(data.record.relatos)) {
            console.log('Relatos carregados do banco:', data.record.relatos.length);
            return data.record.relatos;
        } else {
            return [];
        }
    } catch (error) {
        console.error('Erro ao carregar relatos:', error);
        // Fallback para localStorage se a API falhar
        const relatosLocais = JSON.parse(localStorage.getItem('relatosEcoImpacto') || '[]');
        console.log('Usando relatos locais:', relatosLocais.length);
        return relatosLocais;
    }
}

// Salvar relatos no banco de dados
async function salvarRelatosNoBanco(relatos) {
    try {
        const response = await fetch(JSONBIN_URL, {
            method: 'PUT',
            headers: {
                'X-Master-Key': JSONBIN_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                relatos: relatos,
                ultimaAtualizacao: new Date().toISOString(),
                totalRelatos: relatos.length,
                projeto: "EcoImpacto"
            })
        });

        if (!response.ok) {
            throw new Error('Erro ao salvar relatos no banco de dados');
        }

        const data = await response.json();
        console.log('Relatos salvos com sucesso no banco de dados:', relatos.length);
        return true;
    } catch (error) {
        console.error('Erro ao salvar relatos:', error);
        // Fallback para localStorage
        localStorage.setItem('relatosEcoImpacto', JSON.stringify(relatos));
        console.log('Relatos salvos localmente:', relatos.length);
        return false;
    }
}

// ========== FUNÇÕES MODIFICADAS ==========

// MODIFICADA: Função getUserLocation()
function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            // Fallback para São Paulo se geolocalização não for suportada
            userLocation = { lat: -23.5505, lon: -46.6333 };
            console.log('Geolocalização não suportada, usando São Paulo como fallback');
            resolve();
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                };
                console.log('Localização do usuário obtida:', userLocation);
                await updateLocationDisplay();
                resolve();
            },
            (error) => {
                console.error('Erro na geolocalização:', error);
                // Fallback para São Paulo
                userLocation = { lat: -23.5505, lon: -46.6333 };
                console.log('Usando localização fallback (São Paulo)');
                updateLocationDisplay();
                resolve();
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 600000
            }
        );
    });
}

// MODIFICADA: Função initializeMap()
function initializeMap() {
    // VERIFICA se temos a localização do usuário
    if (!userLocation) {
        console.error('Localização do usuário não disponível para o mapa');
        return;
    }

    // INICIALIZA o mapa na localização do usuário
    mapa = L.map('map').setView([userLocation.lat, userLocation.lon], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(mapa);

    // ADICIONA marcador na localização exata do usuário
    L.marker([userLocation.lat, userLocation.lon])
        .addTo(mapa)
        .bindPopup(`
            <div class="font-sans">
                <h3 class="font-bold text-green-700">📍 Sua Localização Atual</h3>
                <p><strong>Bairro:</strong> ${userBairro || 'Carregando...'}</p>
                <p><strong>Cidade:</strong> ${userCidade || 'Carregando...'}</p>
                <p><strong>Status:</strong> Monitoramento ativo</p>
            </div>
        `)
        .openPopup();

    // Carregar dados reais de alertas
    loadRealAlertsData();
    
    console.log('Mapa inicializado na localização do usuário');
}

// MODIFICADA: Função centralizarNoUsuario()
function centralizarNoUsuario() {
    if (userLocation && mapa) {
        mapa.setView([userLocation.lat, userLocation.lon], 13);
        mostrarNotificacao('🗺️ Mapa centralizado na sua localização atual', 'success');
    } else {
        mostrarNotificacao('❌ Não foi possível detectar sua localização', 'error');
    }
}

// Inicialização do sistema
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    try {
        await getUserLocation();
        await initializeMap();
        
        // NOVO: Carregar relatos do banco de dados
        todosRelatos = await carregarRelatosDoBanco();
        
        await loadAllData();
        
        // Inicializar dashboard estadual
        carregarDashboardEstadual();
        
        // Atualizar dados a cada 10 minutos
        setInterval(loadAllData, 600000);
    } catch (error) {
        console.error('Error initializing app:', error);
        showError('Erro ao inicializar o sistema. Recarregue a página.');
    }
}

// MODIFICADA: Função para salvar relatos (usando banco de dados)
async function salvarRelato(relato) {
    try {
        // Adicionar ao array local
        todosRelatos.unshift(relato);
        
        // NOVO: Salvar no banco de dados
        const sucesso = await salvarRelatosNoBanco(todosRelatos);
        
        if (sucesso) {
            mostrarNotificacao('✅ Relato enviado com sucesso! Salvo no banco de dados.', 'success');
        } else {
            mostrarNotificacao('✅ Relato enviado! (Salvo localmente)', 'success');
        }
        
        // Atualizar a interface
        adicionarRelatoLista(relato);
        atualizarMetricas();
        atualizarRankings();
        atualizarDashboardEstadual();
        
    } catch (error) {
        console.error('Erro ao salvar relato:', error);
        mostrarNotificacao('❌ Erro ao salvar relato. Tente novamente.', 'error');
    }
}

// ========== DASHBOARD ESTADUAL ==========

function carregarDashboardEstadual() {
    const estadoSelecionado = document.getElementById('selecionarEstado').value;
    atualizarVisaoGeralEstadual(estadoSelecionado);
    atualizarTabelaCidades(estadoSelecionado);
    atualizarGraficoProblemas(estadoSelecionado);
    carregarNoticiasEstado(estadoSelecionado);
}

function atualizarVisaoGeralEstadual(estado) {
    const container = document.getElementById('visaoGeralEstadual');
    
    if (!estado) {
        container.innerHTML = `
            <div class="col-span-4 text-center py-8 text-gray-500">
                <i class="fas fa-map-marked-alt text-3xl mb-3"></i>
                <p>Selecione um estado para visualizar os dados</p>
            </div>
        `;
        return;
    }

    const relatosEstado = todosRelatos.filter(relato => relato.estado === estado);
    const relatos7Dias = relatosEstado.filter(relato => {
        const dataRelato = new Date(relato.id);
        return (Date.now() - dataRelato) < 7 * 24 * 60 * 60 * 1000;
    });

    const relatosCriticos = relatosEstado.filter(r => r.gravidade === 'critica').length;
    const problemasUnicos = [...new Set(relatosEstado.map(r => r.tipo))].length;

    // Análise de tendência
    const relatosOntem = relatosEstado.filter(relato => {
        const dataRelato = new Date(relato.id);
        const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return dataRelato > ontem;
    }).length;

    const tendencia = relatosOntem > (relatos7Dias.length / 7) ? 'alta' : 'estavel';

    container.innerHTML = `
        <div class="bg-white p-6 rounded-xl shadow-md card-hover border-l-4 border-blue-500">
            <div class="flex justify-between items-start">
                <div>
                    <p class="text-sm text-gray-500">Total de Relatos</p>
                    <p class="text-2xl font-bold text-blue-600">${relatosEstado.length}</p>
                </div>
                <i class="fas fa-bullhorn text-blue-500 text-xl"></i>
            </div>
            <p class="text-xs text-gray-600 mt-2">Estado ${getNomeEstado(estado)}</p>
        </div>
        
        <div class="bg-white p-6 rounded-xl shadow-md card-hover border-l-4 border-red-500">
            <div class="flex justify-between items-start">
                <div>
                    <p class="text-sm text-gray-500">Relatos Críticos</p>
                    <p class="text-2xl font-bold text-red-600">${relatosCriticos}</p>
                </div>
                <i class="fas fa-exclamation-triangle text-red-500 text-xl"></i>
            </div>
            <p class="text-xs text-gray-600 mt-2">${((relatosCriticos / relatosEstado.length) * 100 || 0).toFixed(1)}% do total</p>
        </div>
        
        <div class="bg-white p-6 rounded-xl shadow-md card-hover border-l-4 border-green-500">
            <div class="flex justify-between items-start">
                <div>
                    <p class="text-sm text-gray-500">Tipos de Problemas</p>
                    <p class="text-2xl font-bold text-green-600">${problemasUnicos}</p>
                </div>
                <i class="fas fa-list-alt text-green-500 text-xl"></i>
            </div>
            <p class="text-xs text-gray-600 mt-2">Diversidade de issues</p>
        </div>
        
        <div class="bg-white p-6 rounded-xl shadow-md card-hover border-l-4 ${tendencia === 'alta' ? 'border-orange-500' : 'border-purple-500'}">
            <div class="flex justify-between items-start">
                <div>
                    <p class="text-sm text-gray-500">Tendência</p>
                    <p class="text-2xl font-bold ${tendencia === 'alta' ? 'text-orange-600' : 'text-purple-600'}">${tendencia === 'alta' ? 'ALTA' : 'ESTÁVEL'}</p>
                </div>
                <i class="fas ${tendencia === 'alta' ? 'fa-arrow-up text-orange-500' : 'fa-minus text-purple-500'} text-xl"></i>
            </div>
            <p class="text-xs text-gray-600 mt-2">Últimos 7 dias</p>
        </div>
    `;
}

function atualizarTabelaCidades(estado) {
    const container = document.getElementById('dadosTabelaCidades');
    
    if (!estado) {
        container.innerHTML = `
            <tr>
                <td colspan="5" class="py-4 text-center text-gray-500">
                    Selecione um estado para ver os dados das cidades
                </td>
            </tr>
        `;
        return;
    }

    const relatosEstado = todosRelatos.filter(relato => relato.estado === estado);
    
    // Agrupar por cidade
    const cidadesMap = {};
    relatosEstado.forEach(relato => {
        if (!cidadesMap[relato.cidade]) {
            cidadesMap[relato.cidade] = {
                relatos: [],
                problemas: {}
            };
        }
        cidadesMap[relato.cidade].relatos.push(relato);
        
        // Contar problemas por tipo
        if (!cidadesMap[relato.cidade].problemas[relato.tipo]) {
            cidadesMap[relato.cidade].problemas[relato.tipo] = 0;
        }
        cidadesMap[relato.cidade].problemas[relato.tipo]++;
    });

    // Ordenar cidades por número de relatos
    const cidadesOrdenadas = Object.entries(cidadesMap)
        .map(([cidade, dados]) => ({
            cidade,
            totalRelatos: dados.relatos.length,
            problemaPrincipal: Object.entries(dados.problemas)
                .sort(([,a], [,b]) => b - a)[0],
            ultimoRelato: Math.max(...dados.relatos.map(r => r.id)),
            gravidade: dados.relatos.some(r => r.gravidade === 'critica') ? 'Crítica' : 
                      dados.relatos.some(r => r.gravidade === 'alta') ? 'Alta' : 'Média'
        }))
        .sort((a, b) => b.totalRelatos - a.totalRelatos)
        .slice(0, 10);

    if (cidadesOrdenadas.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="5" class="py-4 text-center text-gray-500">
                    Nenhum relato encontrado para este estado
                </td>
            </tr>
        `;
        return;
    }

    container.innerHTML = cidadesOrdenadas.map(cidade => `
        <tr class="border-b hover:bg-gray-50">
            <td class="py-3 px-4 font-semibold">${cidade.cidade}</td>
            <td class="py-3 px-4">${getTipoTexto(cidade.problemaPrincipal[0])}</td>
            <td class="py-3 px-4">
                <span class="px-2 py-1 rounded-full text-xs font-semibold ${getCorGravidade(cidade.gravidade.toLowerCase())}">
                    ${cidade.gravidade}
                </span>
            </td>
            <td class="py-3 px-4">${cidade.totalRelatos}</td>
            <td class="py-3 px-4 text-sm text-gray-500">${new Date(cidade.ultimoRelato).toLocaleDateString('pt-BR')}</td>
        </tr>
    `).join('');
}

function atualizarGraficoProblemas(estado) {
    const ctx = document.getElementById('graficoProblemasEstado').getContext('2d');
    
    if (!estado) {
        if (graficoProblemasEstado) {
            graficoProblemasEstado.destroy();
        }
        return;
    }

    const relatosEstado = todosRelatos.filter(relato => relato.estado === estado);
    
    // Agrupar problemas por tipo
    const problemasMap = {};
    relatosEstado.forEach(relato => {
        if (!problemasMap[relato.tipo]) {
            problemasMap[relato.tipo] = 0;
        }
        problemasMap[relato.tipo]++;
    });

    const problemasOrdenados = Object.entries(problemasMap)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8);

    // Destruir gráfico anterior se existir
    if (graficoProblemasEstado) {
        graficoProblemasEstado.destroy();
    }

    graficoProblemasEstado = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: problemasOrdenados.map(([tipo]) => getTipoTexto(tipo)),
            datasets: [{
                data: problemasOrdenados.map(([,quantidade]) => quantidade),
                backgroundColor: [
                    '#EF4444', '#F59E0B', '#10B981', '#3B82F6',
                    '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
                ],
                borderWidth: 2,
                borderColor: '#FFFFFF'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        font: {
                            size: 11
                        }
                    }
                },
                title: {
                    display: true,
                    text: `Distribuição de Problemas - ${getNomeEstado(estado)}`
                }
            }
        }
    });
}

async function carregarNoticiasEstado(estado) {
    const container = document.getElementById('conteudoNoticiasEstado');
    
    if (!estado) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i class="fas fa-newspaper text-3xl mb-3"></i>
                <p>Selecione um estado para ver notícias relacionadas</p>
            </div>
        `;
        return;
    }

    const nomeEstado = getNomeEstado(estado);
    
    try {
        // Buscar notícias relacionadas ao estado
        const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(`https://news.google.com/rss/search?q=${encodeURIComponent(nomeEstado + ' clima segurança alimentar')}&hl=pt-BR&gl=BR&ceid=BR:pt-419`)}`);
        const data = await response.json();
        const text = data.contents;
        
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'text/xml');
        const items = xml.querySelectorAll('item');
        
        const noticias = Array.from(items).slice(0, 5).map(item => {
            const title = item.querySelector('title').textContent;
            const link = item.querySelector('link').textContent;
            const pubDate = new Date(item.querySelector('pubDate').textContent);
            const source = item.querySelector('source') ? item.querySelector('source').textContent : 'Google News';
            
            return {
                title,
                link,
                source,
                date: pubDate.toLocaleDateString('pt-BR'),
                time: pubDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            };
        });

        if (noticias.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-newspaper text-3xl mb-3"></i>
                    <p>Nenhuma notícia recente encontrada para ${nomeEstado}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = noticias.map(noticia => `
            <div class="border-l-4 border-orange-500 bg-gray-50 p-4 rounded-r-lg hover:bg-orange-50 transition cursor-pointer" 
                 onclick="window.open('${noticia.link}', '_blank')">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-bold text-gray-800 flex-1">${noticia.title}</h3>
                    <span class="text-xs text-gray-500 bg-white px-2 py-1 rounded ml-2">${noticia.source}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-xs text-gray-500">${noticia.date} às ${noticia.time}</span>
                    <span class="text-orange-600 text-xs font-semibold">Ler notícia →</span>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Erro ao carregar notícias do estado:', error);
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
                <p>Erro ao carregar notícias para ${nomeEstado}</p>
                <p class="text-sm mt-2">Tente novamente mais tarde</p>
            </div>
        `;
    }
}

function getNomeEstado(sigla) {
    const estados = {
        'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas',
        'BA': 'Bahia', 'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo',
        'GO': 'Goiás', 'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul',
        'MG': 'Minas Gerais', 'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná',
        'PE': 'Pernambuco', 'PI': 'Piauí', 'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte',
        'RS': 'Rio Grande do Sul', 'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina',
        'SP': 'São Paulo', 'SE': 'Sergipe', 'TO': 'Tocantins'
    };
    return estados[sigla] || sigla;
}

// Atualizar o dashboard quando novos relatos forem adicionados
function atualizarDashboardEstadual() {
    const estadoSelecionado = document.getElementById('selecionarEstado').value;
    if (estadoSelecionado) {
        carregarDashboardEstadual();
    }
}

// ========== CONFIGURAÇÃO INICIAL DO BANCO ==========
// Função para criar o banco inicial se não existir
async function configurarBancoInicial() {
    try {
        const relatosExistentes = await carregarRelatosDoBanco();
        if (relatosExistentes.length === 0) {
            console.log('Configurando banco de dados inicial...');
            await salvarRelatosNoBanco([]);
        }
    } catch (error) {
        console.error('Erro na configuração inicial:', error);
    }
}

// Executar configuração quando a página carregar
configurarBancoInicial();
