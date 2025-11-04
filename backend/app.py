from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
from collections import Counter
import uuid

app = Flask(__name__)
CORS(app)

ARQUIVO_RELATOS = 'relatos.json'
ARQUIVO_AVALIACOES = 'avaliacoes_status.json'

def carregar_relatos():
    if not os.path.isfile(ARQUIVO_RELATOS):
        return []
    with open(ARQUIVO_RELATOS, 'r', encoding='utf-8') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []

def salvar_relatos(relatos):
    with open(ARQUIVO_RELATOS, 'w', encoding='utf-8') as f:
        json.dump(relatos, f, ensure_ascii=False, indent=2)

def carregar_avaliacoes():
    if not os.path.isfile(ARQUIVO_AVALIACOES):
        return {}
    with open(ARQUIVO_AVALIACOES, 'r', encoding='utf-8') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {}

def salvar_avaliacoes(avaliacoes):
    with open(ARQUIVO_AVALIACOES, 'w', encoding='utf-8') as f:
        json.dump(avaliacoes, f, ensure_ascii=False, indent=2)

def atualizar_status_oficial(relato_id, avaliacoes):
    avaliacoes_do_relato = avaliacoes.get(str(relato_id), [])
    if len(avaliacoes_do_relato) < 20:
        return None  # Ainda não tem avaliações suficientes

    contador = Counter(avaliacao['status'] for avaliacao in avaliacoes_do_relato)
    status_mais_comum, qtd = contador.most_common(1)[0]
    if qtd >= 20:
        return status_mais_comum
    return None

@app.route('/relatos', methods=['GET'])
def listar_relatos():
    relatos = carregar_relatos()
    avaliacoes = carregar_avaliacoes()
    for i, relato in enumerate(relatos):
        status_atualizado = atualizar_status_oficial(i, avaliacoes)
        if status_atualizado:
            relato['status'] = status_atualizado
    return jsonify(relatos)

@app.route('/relatos', methods=['POST'])
def postar_relato():
    novo = request.json
    if not all(k in novo for k in ['bairro', 'cidade', 'tipo', 'descricao', 'data']):
        return jsonify({'erro': 'Dados incompletos'}), 400
    novo['status'] = "Aberto"
    relatos = carregar_relatos()
    relatos.append(novo)
    salvar_relatos(relatos)
    return jsonify({'mensagem': 'Relato salvo com sucesso'}), 201

@app.route('/relatos/<int:id>/avaliar', methods=['POST'])
def avaliar_relato(id):
    dados = request.json
    status_avaliado = dados.get('status')
    usuario_id = dados.get('usuario_id')

    if status_avaliado not in ['Aberto', 'Em andamento', 'Resolvido']:
        return jsonify({'erro': 'Status inválido'}), 400
    if not usuario_id:
        return jsonify({'erro': 'usuario_id é obrigatório'}), 400

    relatos = carregar_relatos()
    if id < 0 or id >= len(relatos):
        return jsonify({'erro': 'Relato não encontrado'}), 404

    avaliacoes = carregar_avaliacoes()
    chave = str(id)
    if chave not in avaliacoes:
        avaliacoes[chave] = []

    # Verifica se o usuário já avaliou este relato
    for aval in avaliacoes[chave]:
        if aval['usuario_id'] == usuario_id:
            return jsonify({'erro': 'Usuário já avaliou este relato'}), 400

    avaliacoes[chave].append({'usuario_id': usuario_id, 'status': status_avaliado})
    salvar_avaliacoes(avaliacoes)

    # Atualiza status oficial se houver 20 ou mais votos iguais
    status_oficial = atualizar_status_oficial(id, avaliacoes)
    if status_oficial:
        relatos[id]['status'] = status_oficial
        salvar_relatos(relatos)

    return jsonify({'mensagem': 'Avaliação registrada com sucesso', 'status_atual': relatos[id]['status']})

if __name__ == '__main__':
    app.run(debug=True)
