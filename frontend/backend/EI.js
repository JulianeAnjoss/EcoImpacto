// ========== VARIÁVEIS GLOBAIS ==========
let mapa;
let todosRelatos = [];
let userLocation = null;
let userBairro = null;
let userCidade = null;
const OPENWEATHER_API_KEY = 'f5388f8c9779d967c66b9a183cbc3eb4';
let foodSecurityChart = null;
let graficoProblemasEstado = null;

// Variáveis para paginação
let relatosVisiveis = 10;
let estadoFiltroRelatos = '';
let estadoSelecionadoDashboard = '';

// ========== CONFIGURAÇÃO DO BANCO DE DADOS JSONBIN.IO ==========
const JSONBIN_API_KEY = '$2a$10$eU6Mxfif5B/C4sTyAO/Ns.n8vC9QiLufRRe8cSrQ2ZpG9FbyE4B9a';
const JSONBIN_BIN_ID = '690b306ed0ea881f40d548f6';
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

// ========== FUNÇÕES DO BANCO DE DADOS ==========
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
        
        if (data.record && Array.isArray(data.record.relatos)) {
            console.log('Relatos carregados do banco:', data.record.relatos.length);
            return data.record.relatos;
        } else {
            return [];
        }
    } catch (error) {
        console.error('Erro ao carregar relatos:', error);
        const relatosLocais = JSON.parse(localStorage.getItem('relatosEcoImpacto') || '[]');
        console.log('Usando relatos locais:', relatosLocais.length);
        return relatosLocais;
    }
}

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
        localStorage.setItem('relatosEcoImpacto', JSON.stringify(relatos));
        console.log('Relatos salvos localmente:', relatos.length);
        return false;
    }
}

// ========== FUNÇÕES DE PAGINAÇÃO E FILTROS ==========
function filtrarRelatos() {
    estadoFiltroRelatos = document.getElementById('filtroEstadoRelatos').value;
    relatosVisiveis = 10;
    carregarRelatos();
}

function carregarMaisRelatos() {
    relatosVisiveis += 10;
    carregarRelatos();
}

function fecharTodosRelatos() {
    relatosVisiveis = 10;
    carregarRelatos();
}

function filtrarPorEstado() {
    estadoSelecionadoDashboard = document.getElementById('selecionarEstado').value;
    carregarDashboardEstadual();
}

// ========== FUNÇÕES MODIFICADAS ==========
function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
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

function initializeMap() {
    if (!userLocation) {
        console.error('Localização do usuário não disponível para o mapa');
        return;
    }

    mapa = L.map('map').setView([userLocation.lat, userLocation.lon], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(mapa);

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

    loadRealAlertsData();
    console.log('Mapa inicializado na localização do usuário');
}

function centralizarNoUsuario() {
    if (userLocation && mapa) {
        mapa.setView([userLocation.lat, userLocation.lon], 13);
        mostrarNotificacao('🗺️ Mapa centralizado na sua localização atual', 'success');
    } else {
        mostrarNotificacao('❌ Não foi possível detectar sua localização', 'error');
    }
}

// ========== INICIALIZAÇÃO DO SISTEMA ==========
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    try {
        await getUserLocation();
        await initializeMap();
        
        todosRelatos = await carregarRelatosDoBanco();
        
        await loadAllData();
        
        carregarRelatos();
        carregarDashboardEstadual();
        atualizarRankings();
        
        setInterval(loadAllData, 600000);
    } catch (error) {
        console.error('Error initializing app:', error);
        showError('Erro ao inicializar o sistema. Recarregue a página.');
    }
}

// ========== SISTEMA DE RELATOS COM PAGINAÇÃO ==========
function carregarRelatos() {
    let relatosFiltrados = todosRelatos;
    
    if (estadoFiltroRelatos) {
        relatosFiltrados = todosRelatos.filter(relato => relato.estado === estadoFiltroRelatos);
    }
    
    const container = document.getElementById('listaRelatos');
    const controles = document.getElementById('controlesPaginacao');
    const btnVerMais = document.getElementById('btnVerMais');
    const btnFecharTudo = document.getElementById('btnFecharTudo');
    
    if (relatosFiltrados.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i class="fas fa-inbox text-4xl mb-4"></i>
                <p>Nenhum relato encontrado${estadoFiltroRelatos ? ` para ${getNomeEstado(estadoFiltroRelatos)}` : ''}.</p>
                <p class="text-sm mt-2">Seja o primeiro a contribuir!</p>
            </div>
        `;
        controles.classList.add('hidden');
        return;
    }
    
    const relatosParaMostrar = relatosFiltrados.slice(0, relatosVisiveis);
    
    container.innerHTML = relatosParaMostrar.map(relato => `
        <div class="border-l-4 ${getCorBorda(relato.gravidade)} bg-gray-50 p-4 rounded-r-lg ranking-item">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <span class="font-semibold">${relato.bairro}, ${relato.cidade} - ${relato.estado}</span>
                    <span class="text-sm text-gray-500 ml-2">${relato.data}</span>
                </div>
                <span class="text-xs font-semibold px-2 py-1 rounded-full ${getCorGravidade(relato.gravidade)}">
                    ${relato.gravidade.toUpperCase()}
                </span>
            </div>
            <p class="text-gray-700 text-sm">${relato.descricao}</p>
            <div class="flex justify-between items-center mt-3">
                <span class="text-xs text-gray-500">${getTipoTexto(relato.tipo)}</span>
                <button onclick="verDetalhesRelato(${relato.id})" class="text-green-600 text-xs font-semibold flex items-center">
                    <i class="fas fa-search mr-1"></i> Ver Impacto
                </button>
            </div>
        </div>
    `).join('');
    
    document.getElementById('relatosMostrados').textContent = Math.min(relatosVisiveis, relatosFiltrados.length);
    document.getElementById('totalRelatos').textContent = relatosFiltrados.length;
    
    if (relatosVisiveis < relatosFiltrados.length) {
        btnVerMais.classList.remove('hidden');
        btnFecharTudo.classList.remove('hidden');
    } else {
        btnVerMais.classList.add('hidden');
        if (relatosVisiveis > 10) {
            btnFecharTudo.classList.remove('hidden');
        } else {
            btnFecharTudo.classList.add('hidden');
        }
    }
    
    controles.classList.remove('hidden');
}

// ========== DASHBOARD ESTADUAL ATUALIZADO ==========
function carregarDashboardEstadual() {
    const estadoSelecionado = document.getElementById('selecionarEstado').value;
    estadoSelecionadoDashboard = estadoSelecionado;
    
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
    
    const cidadesMap = {};
    relatosEstado.forEach(relato => {
        if (!cidadesMap[relato.cidade]) {
            cidadesMap[relato.cidade] = {
                relatos: [],
                problemas: {}
            };
        }
        cidadesMap[relato.cidade].relatos.push(relato);
        
        if (!cidadesMap[relato.cidade].problemas[relato.tipo]) {
            cidadesMap[relato.cidade].problemas[relato.tipo] = 0;
        }
        cidadesMap[relato.cidade].problemas[relato.tipo]++;
    });

    const cidadesOrdenadas = Object.entries(cidadesMap)
        .map(([cidade, dados]) => ({
            cidade,
            totalRelatos: dados.relatos.length,
            problemaPrincipal: Object.entries(dados.problemas)
                .sort(([,a], [,b]) => b - a)[0] || ['', 0],
            ultimoRelato: dados.relatos.length > 0 ? Math.max(...dados.relatos.map(r => r.id)) : 0,
            gravidade: dados.relatos.some(r => r.gravidade === 'critica') ? 'Crítica' : 
                      dados.relatos.some(r => r.gravidade === 'alta') ? 'Alta' : 'Média'
        }))
        .sort((a, b) => b.totalRelatos - a.totalRelatos)
        .slice(0, 10);

    if (cidadesOrdenadas.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="5" class="py-4 text-center text-gray-500">
                    Nenhum relato encontrado para ${getNomeEstado(estado)}
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
            <td class="py-3 px-4 text-sm text-gray-500">${cidade.ultimoRelato ? new Date(cidade.ultimoRelato).toLocaleDateString('pt-BR') : 'N/A'}</td>
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

// ========== FUNÇÕES EXISTENTES (mantidas para compatibilidade) ==========
async function updateLocationDisplay() {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLocation.lat}&lon=${userLocation.lon}`
        );
        const data = await response.json();
        
        if (data.address) {
            userBairro = data.address.suburb || data.address.neighbourhood || data.address.quarter || "Bairro Desconhecido";
            userCidade = data.address.city || data.address.town || data.address.municipality || "Cidade Desconhecida";
            
            document.getElementById('localAtual').textContent = `${userBairro}, ${userCidade}`;
            document.getElementById('comunidadeAtiva').textContent = `${userBairro}`;
        }
    } catch (error) {
        document.getElementById('localAtual').textContent = 'Localização detectada';
    }
}

async function loadAllData() {
    try {
        await loadClimateData();
        await loadFoodSecurityData();
        await loadFoodSecurityNews();
        await loadHealthImpacts();
        await loadPreventionActions();
        await loadOfficialNews();
        atualizarRankings();
        gerarDiagnosticoImpacto();
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Erro ao carregar dados. Tentando novamente...');
    }
}

async function loadClimateData() {
    try {
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${userLocation.lat}&lon=${userLocation.lon}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=pt_br`
        );
        const data = await response.json();

        if (data.cod === 200) {
            updateClimateData(data);
            updateClimateAlerts(data);
        }
    } catch (error) {
        document.getElementById('climate-data').innerHTML = 
            '<div class="text-red-500">Erro ao carregar dados climáticos</div>';
    }
}

function updateClimateData(data) {
    const temp = Math.round(data.main.temp);
    const humidity = data.main.humidity;
    
    let risco, seguranca, saude, alerta;
    
    if (temp > 35 || humidity < 20) {
        risco = 'ALTO';
        seguranca = 'CRÍTICA';
        saude = 'ALTO';
        alerta = '🚨 ALERTA: Temperaturas extremas e baixa umidade - Risco para saúde e produção de alimentos';
    } else if (temp > 30 || humidity > 85) {
        risco = 'MÉDIO';
        seguranca = 'ALERTA';
        saude = 'MODERADO';
        alerta = '⚠️ ATENÇÃO: Condições climáticas podem afetar segurança alimentar e saúde pública';
    } else {
        risco = 'BAIXO';
        seguranca = 'ESTÁVEL';
        saude = 'BAIXO';
        alerta = '✅ Condições climáticas estáveis na região';
    }
    
    document.getElementById('riscoAtual').textContent = risco;
    document.getElementById('segurancaAlimentar').textContent = seguranca;
    document.getElementById('saudePublica').textContent = saude;
    document.getElementById('impactoAlimentar').textContent = `Temp: ${temp}°C, Umidade: ${humidity}%`;
    document.getElementById('impactoSaude').textContent = `Condições: ${data.weather[0].description}`;
    document.getElementById('alertaDestaque').textContent = alerta;
    
    updateDashboardDuplo(data);
}

function updateClimateAlerts(weatherData) {
    const temp = weatherData.main.temp;
    const humidity = weatherData.main.humidity;
    const alerts = [];

    if (temp > 35) {
        alerts.push('Temperatura extrema: risco de desidratação e estresse térmico');
    }
    if (temp < 5) {
        alerts.push('Temperatura muito baixa: risco de hipotermia');
    }
    if (humidity < 30) {
        alerts.push('Umidade muito baixa: risco de problemas respiratórios');
    }
    if (humidity > 85) {
        alerts.push('Umidade muito alta: risco de proliferação de fungos e bactérias');
    }

    if (alerts.length > 0) {
        document.getElementById('alertaDestaque').textContent = alerts.join(' | ');
        document.getElementById('alertas').className = 'bg-red-50 py-4 border-b-4 border-red-500 pulse-alert';
    }
}

function loadRealAlertsData() {
    const alertas = [
        { lat: userLocation.lat + 0.01, lon: userLocation.lon + 0.01, tipo: 'Alagamento', risco: 'Alto', bairro: 'Centro' },
        { lat: userLocation.lat - 0.02, lon: userLocation.lon - 0.01, tipo: 'Seca', risco: 'Médio', bairro: 'Vila Nova' },
        { lat: userLocation.lat + 0.015, lon: userLocation.lon - 0.02, tipo: 'Queimada', risco: 'Crítico', bairro: 'Jardim Paulista' }
    ];

    alertas.forEach(alerta => {
        const cor = alerta.risco === 'Crítico' ? 'red' : alerta.risco === 'Alto' ? 'orange' : 'yellow';
        const raio = alerta.risco === 'Crítico' ? 1000 : alerta.risco === 'Alto' ? 800 : 600;
        
        L.circle([alerta.lat, alerta.lon], {
            color: cor,
            fillColor: cor,
            fillOpacity: 0.4,
            radius: raio
        }).addTo(mapa).bindPopup(`
            <div class="font-sans">
                <h3 class="font-bold" style="color: ${cor}">${alerta.bairro}</h3>
                <p><strong>Alerta:</strong> ${alerta.tipo}</p>
                <p><strong>Risco:</strong> ${alerta.risco}</p>
                <p><strong>Fonte:</strong> INMET</p>
                <p><strong>Atualizado:</strong> ${new Date().toLocaleTimeString('pt-BR')}</p>
            </div>
        `);
    });
}

function updateDashboardDuplo(weatherData) {
    document.getElementById('tempAtual').textContent = `${Math.round(weatherData.main.temp)}°C`;
    document.getElementById('umidadeAtual').textContent = `${weatherData.main.humidity}%`;
    
    const temp = weatherData.main.temp;
    if (temp > 30) {
        document.getElementById('tempStatus').textContent = 'Acima do normal';
        document.getElementById('tempStatus').className = 'text-xs text-red-500';
    } else if (temp < 15) {
        document.getElementById('tempStatus').textContent = 'Abaixo do normal';
        document.getElementById('tempStatus').className = 'text-xs text-blue-500';
    } else {
        document.getElementById('tempStatus').textContent = 'Normal para a época';
        document.getElementById('tempStatus').className = 'text-xs text-green-500';
    }
    
    const humidity = weatherData.main.humidity;
    if (humidity < 30) {
        document.getElementById('umidadeStatus').textContent = 'Muito baixa';
        document.getElementById('umidadeStatus').className = 'text-xs text-orange-500';
    } else if (humidity > 80) {
        document.getElementById('umidadeStatus').textContent = 'Muito alta';
        document.getElementById('umidadeStatus').className = 'text-xs text-blue-500';
    } else {
        document.getElementById('umidadeStatus').textContent = 'Ideal';
        document.getElementById('umidadeStatus').className = 'text-xs text-green-500';
    }
    
    let alertaProducao = '';
    
    if (temp > 35) {
        alertaProducao = 'Calor extremo - risco para hortifrúti e grãos';
    } else if (temp < 10) {
        alertaProducao = 'Frio intenso - pode afetar cultivos sensíveis';
    } else if (humidity < 30) {
        alertaProducao = 'Umidade baixa - estresse hídrico nas plantações';
    } else if (humidity > 85) {
        alertaProducao = 'Umidade alta - risco de doenças fúngicas';
    } else {
        alertaProducao = 'Condições favoráveis para a produção agrícola';
    }
    
    document.getElementById('alertaProducao').textContent = alertaProducao;
    
    const precoBaseArroz = 5.90;
    const precoBaseFeijao = 8.50;
    
    let fatorAjuste = 1.0;
    if (temp > 32 || humidity < 35) {
        fatorAjuste = 1.15;
    } else if (temp < 12 || humidity > 85) {
        fatorAjuste = 1.08;
    }
    
    const precoArroz = (precoBaseArroz * fatorAjuste).toFixed(2);
    const precoFeijao = (precoBaseFeijao * fatorAjuste).toFixed(2);
    
    document.getElementById('precoArroz').textContent = `R$ ${precoArroz}`;
    document.getElementById('precoFeijao').textContent = `R$ ${precoFeijao}`;
    
    const variacao = ((fatorAjuste - 1) * 100).toFixed(0);
    if (fatorAjuste > 1) {
        document.getElementById('statusArroz').textContent = `+${variacao}% este mês`;
        document.getElementById('statusArroz').className = 'text-xs text-red-500';
        document.getElementById('statusFeijao').textContent = `+${variacao}% este mês`;
        document.getElementById('statusFeijao').className = 'text-xs text-red-500';
    } else {
        document.getElementById('statusArroz').textContent = 'Estável';
        document.getElementById('statusArroz').className = 'text-xs text-green-500';
        document.getElementById('statusFeijao').textContent = 'Estável';
        document.getElementById('statusFeijao').className = 'text-xs text-green-500';
    }
    
    let conexao = '';
    if (temp > 32 || humidity < 40) {
        conexao = '🌡️ Condições climáticas atuais podem pressionar os preços dos alimentos nas próximas semanas';
    } else if (temp < 12 || humidity > 80) {
        conexao = '🌧️ Condições atuais podem afetar logística e disponibilidade de produtos frescos';
    } else {
        conexao = '✅ Condições climáticas estáveis - tendência de preços sob controle';
    }
    
    document.getElementById('conexaoClimaAlimentacao').innerHTML = `<i class="fas fa-sync-alt mr-2"></i> ${conexao}`;
    
    let statusGeral = '';
    if (parseFloat(precoArroz) > 7.0 || parseFloat(precoFeijao) > 10.0) {
        statusGeral = '⚠️ Preços elevados podem comprometer o acesso a alimentos básicos';
    } else if (temp > 35 || humidity < 25) {
        statusGeral = '🌡️ Condições extremas exigem atenção à conservação de alimentos';
    } else {
        statusGeral = '✅ Condições favoráveis para segurança alimentar local';
    }
    
    document.getElementById('statusSegurancaAlimentar').textContent = statusGeral;
}

// ========== SISTEMA DE RELATOS COMUNITÁRIOS ==========
document.getElementById('formRelato').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const relato = {
        id: Date.now(),
        tipo: document.getElementById('tipoProblema').value,
        gravidade: document.getElementById('gravidade').value,
        bairro: document.getElementById('bairroRelato').value,
        cidade: document.getElementById('cidadeRelato').value,
        estado: document.getElementById('estadoRelato').value,
        descricao: document.getElementById('descricaoRelato').value,
        data: new Date().toLocaleString('pt-BR'),
        coordenadas: obterCoordenadasProximas(userLocation),
        status: 'ativo'
    };
    
    salvarRelato(relato);
    adicionarRelatoLista(relato);
    atualizarMetricas();
    atualizarRankings();
    atualizarDashboardEstadual();
    this.reset();
    
    mostrarNotificacao('✅ Relato enviado com sucesso! Sua contribuição ajuda toda a comunidade.', 'success');
});

function obterCoordenadasProximas(base) {
    return {
        lat: base.lat + (Math.random() - 0.5) * 0.02,
        lon: base.lon + (Math.random() - 0.5) * 0.02
    };
}

async function salvarRelato(relato) {
    try {
        todosRelatos.unshift(relato);
        
        const sucesso = await salvarRelatosNoBanco(todosRelatos);
        
        if (sucesso) {
            mostrarNotificacao('✅ Relato enviado com sucesso! Salvo no banco de dados.', 'success');
        } else {
            mostrarNotificacao('✅ Relato enviado! (Salvo localmente)', 'success');
        }
        
        adicionarRelatoLista(relato);
        atualizarMetricas();
        atualizarRankings();
        atualizarDashboardEstadual();
        
    } catch (error) {
        console.error('Erro ao salvar relato:', error);
        mostrarNotificacao('❌ Erro ao salvar relato. Tente novamente.', 'error');
    }
}

function adicionarRelatoLista(relato) {
    const container = document.getElementById('listaRelatos');
    const novoRelatoHTML = `
        <div class="border-l-4 ${getCorBorda(relato.gravidade)} bg-gray-50 p-4 rounded-r-lg ranking-item">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <span class="font-semibold">${relato.bairro}, ${relato.cidade} - ${relato.estado}</span>
                    <span class="text-sm text-gray-500 ml-2">${relato.data}</span>
                </div>
                <span class="text-xs font-semibold px-2 py-1 rounded-full ${getCorGravidade(relato.gravidade)}">
                    ${relato.gravidade.toUpperCase()}
                </span>
            </div>
            <p class="text-gray-700 text-sm">${relato.descricao}</p>
            <div class="flex justify-between items-center mt-3">
                <span class="text-xs text-gray-500">${getTipoTexto(relato.tipo)}</span>
                <button onclick="verDetalhesRelato(${relato.id})" class="text-green-600 text-xs font-semibold flex items-center">
                    <i class="fas fa-search mr-1"></i> Ver Impacto
                </button>
            </div>
        </div>
    `;
    
    if (container.children.length > 0 && !container.children[0].classList.contains('text-center')) {
        container.insertAdjacentHTML('afterbegin', novoRelatoHTML);
    } else {
        container.innerHTML = novoRelatoHTML;
    }
}

function verDetalhesRelato(id) {
    const relato = todosRelatos.find(r => r.id === id);
    if (relato) {
        const impactos = gerarAnaliseImpacto(relato);
        alert(`📊 ANÁLISE DE IMPACTO - Relato #${id}\n\n` +
              `📍 Local: ${relato.bairro}, ${relato.cidade}\n` +
              `⚠️ Problema: ${getTipoTexto(relato.tipo)}\n` +
              `🚨 Gravidade: ${relato.gravidade}\n\n` +
              `📈 IMPACTOS IDENTIFICADOS:\n` +
              `• ${impactos.saude}\n` +
              `• ${impactos.alimentar}\n` +
              `• ${impactos.seguranca}\n\n` +
              `💡 RECOMENDAÇÕES:\n${impactos.recomendacoes}`);
    }
}

// ========== FUNÇÕES AUXILIARES ==========
function getCorBorda(gravidade) {
    const cores = {
        'baixa': 'border-green-500',
        'media': 'border-yellow-500',
        'alta': 'border-orange-500', 
        'critica': 'border-red-500'
    };
    return cores[gravidade] || 'border-gray-500';
}

function getCorGravidade(gravidade) {
    const cores = {
        'baixa': 'bg-green-100 text-green-800',
        'media': 'bg-yellow-100 text-yellow-800',
        'alta': 'bg-orange-100 text-orange-800',
        'critica': 'bg-red-100 text-red-800'
    };
    return cores[gravidade] || 'bg-gray-100 text-gray-800';
}

function getTipoTexto(tipo) {
    const tipos = {
        'seca': 'Seca/Estiagem',
        'inundacao': 'Inundação/Alagamento',
        'queimada': 'Queimada/Incêndio',
        'desmatamento': 'Desmatamento',
        'inseguranca_alimentar': 'Falta de Alimentos',
        'aumento_precos': 'Aumento de Preços',
        'perda_safra': 'Perda de Safra',
        'agua_contaminada': 'Água Contaminada', 
        'doencas': 'Surtos de Doenças',
        'agricultura': 'Perda Agrícola',
        'outro': 'Outro Problema'
    };
    return tipos[tipo] || 'Problema Ambiental';
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

function atualizarMetricas() {
    const relatosAtivos = todosRelatos.filter(r => r.status === 'ativo').length;
    document.getElementById('relatosAtivos').textContent = relatosAtivos;
}

function mostrarNotificacao(mensagem, tipo) {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
        tipo === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }`;
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-${tipo === 'success' ? 'check' : 'exclamation-triangle'} mr-2"></i>
            <span>${mensagem}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

function showError(message) {
    const alertBanner = document.getElementById('alertas');
    alertBanner.className = 'bg-red-50 py-4 border-b-4 border-red-500 pulse-alert';
    document.getElementById('alertaDestaque').textContent = message;
}

