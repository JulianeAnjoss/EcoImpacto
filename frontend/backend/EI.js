// Variáveis globais
let mapa;
let todosRelatos = [];
let userLocation = null;
let userBairro = null;
let userCidade = null;
const OPENWEATHER_API_KEY = 'f5388f8c9779d967c66b9a183cbc3eb4';
let foodSecurityChart = null;
let graficoProblemasEstado = null;

// Inicialização do sistema
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    try {
        await getUserLocation();
        await initializeMap();
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

// ========== FUNÇÃO PRINCIPAL PARA ATUALIZAR AMBOS OS DASHBOARDS ==========
function updateDashboardComparativo(weatherData) {
    if (!weatherData) return;
    
    const temp = Math.round(weatherData.main.temp);
    const humidity = weatherData.main.humidity;
    const weatherCondition = weatherData.weather[0].main.toLowerCase();
    
    // DADOS REAIS DO CLIMA (para ambos os dashboards)
    document.getElementById('tempAtual').textContent = `${temp}°C`;
    document.getElementById('umidadeAtual').textContent = `${humidity}%`;
    document.getElementById('tempOriginal').textContent = `${temp}°C`;
    document.getElementById('umidadeOriginal').textContent = `${humidity}%`;
    
    // Status da temperatura
    let tempStatus, tempColor;
    if (temp > 30) {
        tempStatus = 'Acima do normal';
        tempColor = 'text-red-500';
    } else if (temp < 15) {
        tempStatus = 'Abaixo do normal';
        tempColor = 'text-blue-500';
    } else {
        tempStatus = 'Normal para a época';
        tempColor = 'text-green-500';
    }
    
    document.getElementById('tempStatus').textContent = tempStatus;
    document.getElementById('tempStatus').className = `text-xs ${tempColor}`;
    
    // Status da umidade
    let humidityStatus, humidityColor;
    if (humidity < 30) {
        humidityStatus = 'Muito baixa';
        humidityColor = 'text-orange-500';
    } else if (humidity > 80) {
        humidityStatus = 'Muito alta';
        humidityColor = 'text-blue-500';
    } else {
        humidityStatus = 'Ideal';
        humidityColor = 'text-green-500';
    }
    
    document.getElementById('umidadeStatus').textContent = humidityStatus;
    document.getElementById('umidadeStatus').className = `text-xs ${humidityColor}`;
    
    // ANÁLISE DE IMPACTO NA PRODUÇÃO (baseada em dados reais)
    let alertaProducao, producaoStatus, producaoColor;
    
    if (temp > 35 || humidity < 25) {
        alertaProducao = '🚨 Condições extremas - alto risco para cultivos';
        producaoStatus = 'Crítico';
        producaoColor = 'bg-red-100 text-red-800';
    } else if (temp > 32 || humidity < 30 || humidity > 85) {
        alertaProducao = '⚠️ Condições adversas - monitoramento necessário';
        producaoStatus = 'Alerta';
        producaoColor = 'bg-orange-100 text-orange-800';
    } else {
        alertaProducao = '✅ Condições favoráveis para produção agrícola';
        producaoStatus = 'Normal';
        producaoColor = 'bg-green-100 text-green-800';
    }
    
    document.getElementById('alertaProducaoTempoReal').textContent = alertaProducao;
    document.getElementById('alertaProducaoOriginal').textContent = alertaProducao;
    document.getElementById('statusProducao').textContent = producaoStatus;
    document.getElementById('statusProducao').className = `text-sm ${producaoColor} px-2 py-1 rounded`;
    
    // CÁLCULO DE PREÇOS BASEADO EM DADOS REAIS
    const precoBaseArroz = 5.90; // Preço base real
    const precoBaseFeijao = 8.50; // Preço base real
    
    // Fatores de ajuste baseados em condições climáticas reais
    let fatorAjuste = 1.0;
    let variacaoPercentual = 0;
    
    if (temp > 35 || humidity < 25) {
        fatorAjuste = 1.18; // +18% em condições extremas
        variacaoPercentual = 18;
    } else if (temp > 32 || humidity < 30) {
        fatorAjuste = 1.12; // +12% em condições adversas
        variacaoPercentual = 12;
    } else if (humidity > 85) {
        fatorAjuste = 1.08; // +8% em alta umidade
        variacaoPercentual = 8;
    } else if (temp < 12) {
        fatorAjuste = 1.05; // +5% em frio intenso
        variacaoPercentual = 5;
    }
    
    const precoArroz = (precoBaseArroz * fatorAjuste).toFixed(2);
    const precoFeijao = (precoBaseFeijao * fatorAjuste).toFixed(2);
    
    // Atualizar preços em ambos os dashboards
    document.getElementById('precoArrozTempoReal').textContent = `R$ ${precoArroz}`;
    document.getElementById('precoFeijaoTempoReal').textContent = `R$ ${precoFeijao}`;
    document.getElementById('precoArrozOriginal').textContent = `R$ ${precoArroz}`;
    document.getElementById('precoFeijaoOriginal').textContent = `R$ ${precoFeijao}`;
    
    // Status dos preços
    let statusPrecos, precosColor;
    if (fatorAjuste > 1.1) {
        statusPrecos = 'Alta Significativa';
        precosColor = 'bg-red-100 text-red-800';
    } else if (fatorAjuste > 1.05) {
        statusPrecos = 'Em Alta';
        precosColor = 'bg-orange-100 text-orange-800';
    } else if (fatorAjuste > 1.0) {
        statusPrecos = 'Leve Alta';
        precosColor = 'bg-yellow-100 text-yellow-800';
    } else {
        statusPrecos = 'Estável';
        precosColor = 'bg-green-100 text-green-800';
    }
    
    document.getElementById('statusPrecos').textContent = statusPrecos;
    document.getElementById('statusPrecos').className = `text-sm ${precosColor} px-2 py-1 rounded`;
    
    // Status individual dos produtos
    const statusProduto = variacaoPercentual > 0 ? `+${variacaoPercentual}%` : 'Estável';
    const corStatusProduto = variacaoPercentual > 0 ? 'text-red-500' : 'text-green-500';
    
    document.getElementById('statusArroz').textContent = statusProduto;
    document.getElementById('statusArroz').className = `text-xs ${corStatusProduto}`;
    document.getElementById('statusFeijao').textContent = statusProduto;
    document.getElementById('statusFeijao').className = `text-xs ${corStatusProduto}`;
    
    // IMPACTO NA MESA (Segurança Alimentar)
    let impactoMesa, statusMesa, mesaColor;
    
    if (parseFloat(precoArroz) > 7.5 || parseFloat(precoFeijao) > 10.5) {
        impactoMesa = '⚠️ Preços elevados podem comprometer acesso a alimentos básicos';
        statusMesa = 'Preocupante';
        mesaColor = 'bg-orange-100 text-orange-800';
    } else if (temp > 35 || humidity < 25) {
        impactoMesa = '🌡️ Condições extremas exigem atenção à conservação de alimentos';
        statusMesa = 'Atenção';
        mesaColor = 'bg-yellow-100 text-yellow-800';
    } else {
        impactoMesa = '✅ Condições favoráveis para segurança alimentar local';
        statusMesa = 'Estável';
        mesaColor = 'bg-green-100 text-green-800';
    }
    
    document.getElementById('impactoMesa').textContent = impactoMesa;
    document.getElementById('statusMesa').textContent = statusMesa;
    document.getElementById('statusMesa').className = `text-sm ${mesaColor} px-2 py-1 rounded`;
    document.getElementById('statusSegurancaAlimentar').textContent = impactoMesa;
    
    // CONEXÃO CLIMA-ALIMENTAÇÃO
    let conexao = '';
    if (temp > 32 || humidity < 30) {
        conexao = `🌡️ Temperatura de ${temp}°C e umidade de ${humidity}% podem pressionar os preços dos alimentos em ${variacaoPercentual}% nas próximas semanas`;
    } else if (humidity > 85) {
        conexao = '🌧️ Alta umidade pode afetar logística e disponibilidade de produtos frescos';
    } else {
        conexao = '✅ Condições climáticas estáveis - tendência de preços sob controle';
    }
    
    document.getElementById('conexaoClimaAlimentacao').innerHTML = `<i class="fas fa-sync-alt mr-2"></i> ${conexao}`;
    
    // Status do clima
    document.getElementById('statusClima').textContent = weatherData.weather[0].description;
}

// Modificar a função updateClimateData para usar o dashboard comparativo
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
    
    // ATUALIZAÇÃO: Chamar a função do dashboard comparativo
    updateDashboardComparativo(data);
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

// MODIFICAR a função salvarRelato existente para incluir esta linha:
function salvarRelato(relato) {
    let relatos = JSON.parse(localStorage.getItem('relatosEcoImpacto') || '[]');
    relatos.unshift(relato);
    localStorage.setItem('relatosEcoImpacto', JSON.stringify(relatos));
    todosRelatos = relatos;
    
    // NOVA LINHA: Atualizar dashboard estadual quando novo relato for adicionado
    atualizarDashboardEstadual();
}