const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const app = express();
const PORT = 3000;

const JOGADORES_FILE = path.join(__dirname, 'data', 'jogadores.json');
const TIMEDOMES_FILE = path.join(__dirname, 'data', 'time-do-mes.json');
const CAIXINHA_FILE = path.join(__dirname, 'data', 'caixinha.json');
const PAGAMENTOS_FILE = path.join(__dirname, 'data', 'pagamentos.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

app.use(express.static(path.join(__dirname)));
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// --- Funções Helper ---
const readJsonFile = (filePath, defaultData) => {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf8');
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Erro ao ler arquivo ${filePath}:`, error);
        return defaultData;
    }
};
const writeJsonFile = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) { console.error(`Erro ao escrever arquivo ${filePath}:`, error); }
};

// --- Funções Específicas ---
const readJogadores = () => {
    let jogadores = readJsonFile(JOGADORES_FILE, []);
    let dataChanged = false;
    jogadores.forEach(j => {
        if (!j.id) { j.id = Date.now() + Math.random(); dataChanged = true; }
    });
    if (dataChanged) writeJsonFile(JOGADORES_FILE, jogadores);
    return jogadores;
};
const writeJogadores = (data) => writeJsonFile(JOGADORES_FILE, data);
const readTimeDoMes = () => readJsonFile(TIMEDOMES_FILE, { time1: { goleiro: null, linha: [], reservas: [] }, time2: { goleiro: null, linha: [], reservas: [] }});
const writeTimeDoMes = (data) => writeJsonFile(TIMEDOMES_FILE, data);
const readCaixinha = () => readJsonFile(CAIXINHA_FILE, { saldoTotal: 0, transacoes: [] });
const writeCaixinha = (data) => writeJsonFile(CAIXINHA_FILE, data);
const readPagamentos = () => readJsonFile(PAGAMENTOS_FILE, { valorChurrascoBase: 0, pagamentosJogadores: {} });
const writePagamentos = (data) => writeJsonFile(PAGAMENTOS_FILE, data);

// --- Rotas de Páginas ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/pagamentos', (req, res) => res.sendFile(path.join(__dirname, 'pagamentos.html')));
app.get('/caixinha', (req, res) => res.sendFile(path.join(__dirname, 'caixinha.html')));
app.get('/jogadores', (req, res) => res.sendFile(path.join(__dirname, 'jogadores.html')));
app.get('/time-do-mes', (req, res) => res.sendFile(path.join(__dirname, 'time-do-mes.html')));

// --- API de Jogadores ---
app.get('/api/jogadores', (req, res) => res.json(readJogadores()));

app.post('/api/jogadores', upload.single('foto'), (req, res) => {
    const jogadores = readJogadores();
    const novoJogador = {
        id: Date.now(),
        nome: req.body.nome,
        isGoleiro: req.body.isGoleiro === 'true',
        foto: req.file ? `/uploads/${req.file.filename}` : ''
    };
    jogadores.push(novoJogador);
    writeJogadores(jogadores);
    res.status(201).json(novoJogador);
});

// --- ROTA DE EDIÇÃO (PUT) ATUALIZADA ---
app.put('/api/jogadores/:id', upload.single('foto'), (req, res) => {
    let jogadores = readJogadores();
    const jogadorId = Number(req.params.id);
    const jogadorIndex = jogadores.findIndex(j => j.id === jogadorId);

    if (jogadorIndex === -1) {
        return res.status(404).json({ message: 'Jogador não encontrado' });
    }

    const jogador = jogadores[jogadorIndex];

    // Se uma nova foto foi enviada
    if (req.file) {
        // 1. Deletar a foto antiga, se ela existir
        if (jogador.foto) {
            const oldFotoPath = path.join(__dirname, jogador.foto);
            if (fs.existsSync(oldFotoPath)) {
                fs.unlink(oldFotoPath, (err) => {
                    if (err) console.error("Erro ao deletar foto antiga:", err);
                });
            }
        }
        // 2. Atualizar com o caminho da nova foto
        jogador.foto = `/uploads/${req.file.filename}`;
    }

    // 3. Atualizar nome e status de goleiro
    jogador.nome = req.body.nome || jogador.nome;
    jogador.isGoleiro = req.body.isGoleiro === 'true';

    // 4. Salvar o array de jogadores atualizado
    jogadores[jogadorIndex] = jogador;
    writeJogadores(jogadores);

    res.status(200).json(jogador); // Retorna o jogador atualizado
});

app.delete('/api/jogadores/:id', (req, res) => {
    let jogadores = readJogadores();
    const jogadorId = Number(req.params.id);
    const jogadorParaRemover = jogadores.find(j => j.id === jogadorId);
    const novosJogadores = jogadores.filter(j => j.id !== jogadorId);
    if (jogadores.length === novosJogadores.length) return res.status(404).json({ message: 'Jogador não encontrado' });
    if (jogadorParaRemover && jogadorParaRemover.foto) {
        fs.unlink(path.join(__dirname, jogadorParaRemover.foto), (err) => { if (err) console.error("Erro ao deletar foto:", err); });
    }
    writeJogadores(novosJogadores);
    res.status(200).json({ message: 'Jogador removido com sucesso' });
});

// --- API do Time do Mês ---
app.get('/api/time-do-mes', (req, res) => res.json(readTimeDoMes()));
app.post('/api/time-do-mes', (req, res) => {
    writeTimeDoMes(req.body);
    res.status(200).json({ message: 'Times salvos com sucesso!' });
});

// --- API da Caixinha ---
app.get('/api/caixinha', (req, res) => res.json(readCaixinha()));
app.post('/api/caixinha', (req, res) => {
    const caixinhaData = readCaixinha();
    const novaTransacao = req.body;
    novaTransacao.id = Date.now();
    novaTransacao.data = new Date().toISOString();
    if (novaTransacao.tipo === 'entrada') {
        caixinhaData.saldoTotal += novaTransacao.valor;
    } else {
        caixinhaData.saldoTotal -= novaTransacao.valor;
    }
    caixinhaData.transacoes.unshift(novaTransacao);
    writeCaixinha(caixinhaData);
    res.status(201).json(caixinhaData);
});

// --- APIs de Pagamentos ---
app.get('/api/pagamentos', (req, res) => res.json(readPagamentos()));
app.post('/api/pagamentos/config', (req, res) => {
    const { valorChurrascoBase } = req.body;
    const pagamentos = readPagamentos();
    pagamentos.valorChurrascoBase = parseFloat(valorChurrascoBase) || 0;
    writePagamentos(pagamentos);
    res.status(200).json(pagamentos);
});

app.post('/api/pagamentos/pagar', (req, res) => {
    const { jogadorId, jogadorNome, tipo, valor } = req.body;
    
    if (tipo === 'mensalidade') {
        const jogador = readJogadores().find(j => j.id == jogadorId);
        if (jogador && jogador.isGoleiro) {
            return res.status(400).json({ message: 'Goleiros são isentos da mensalidade.' });
        }
    }
    
    const pagamentos = readPagamentos();
    if (!pagamentos.pagamentosJogadores[jogadorId]) {
        pagamentos.pagamentosJogadores[jogadorId] = {};
    }
    if (pagamentos.pagamentosJogadores[jogadorId][tipo]) {
        return res.status(400).json({ message: 'Este jogador já pagou esta taxa.' });
    }

    const caixinhaData = readCaixinha();
    const descricao = tipo === 'mensalidade' ? 'Pagamento Mensalidade' : 'Pagamento Churrasco';
    const novaTransacao = {
        id: Date.now(),
        data: new Date().toISOString(),
        descricao: `${descricao} - ${jogadorNome}`,
        valor: parseFloat(valor),
        tipo: 'entrada',
        jogadorId: jogadorId,
        jogadorNome: jogadorNome
    };
    caixinhaData.saldoTotal += novaTransacao.valor;
    caixinhaData.transacoes.unshift(novaTransacao);
    writeCaixinha(caixinhaData);

    pagamentos.pagamentosJogadores[jogadorId][tipo] = novaTransacao.id;
    writePagamentos(pagamentos);

    res.status(200).json({ pagamentos, caixinha: caixinhaData });
});

// --- Rotas de Cancelar e Resetar ---
app.post('/api/pagamentos/cancelar', (req, res) => {
    const { jogadorId, tipo } = req.body;
    const pagamentos = readPagamentos();
    
    if (!pagamentos.pagamentosJogadores[jogadorId] || !pagamentos.pagamentosJogadores[jogadorId][tipo]) {
        return res.status(404).json({ message: 'Pagamento não encontrado.' });
    }
    
    const transacaoId = pagamentos.pagamentosJogadores[jogadorId][tipo];
    const caixinhaData = readCaixinha();
    
    const transacaoIndex = caixinhaData.transacoes.findIndex(t => t.id === transacaoId);
    if (transacaoIndex === -1) {
        pagamentos.pagamentosJogadores[jogadorId][tipo] = null;
        writePagamentos(pagamentos);
        return res.status(404).json({ message: 'Transação na caixinha não encontrada, mas pagamento foi resetado.' });
    }
    
    const transacaoRemovida = caixinhaData.transacoes.splice(transacaoIndex, 1)[0];
    caixinhaData.saldoTotal -= transacaoRemovida.valor;
    writeCaixinha(caixinhaData);
    
    pagamentos.pagamentosJogadores[jogadorId][tipo] = null;
    writePagamentos(pagamentos);
    
    res.status(200).json({ pagamentos, caixinha: caixinhaData });
});

app.post('/api/pagamentos/reset', (req, res) => {
    const pagamentos = readPagamentos();
    pagamentos.pagamentosJogadores = {};
    writePagamentos(pagamentos);
    res.status(200).json(pagamentos);
});

app.post('/api/caixinha/reset', (req, res) => {
    writeCaixinha({ saldoTotal: 0, transacoes: [] });
    res.status(200).json({ message: 'Caixinha zerada.' });
});

app.post('/api/time-do-mes/reset', (req, res) => {
    writeTimeDoMes({ time1: { goleiro: null, linha: [], reservas: [] }, time2: { goleiro: null, linha: [], reservas: [] }});
    res.status(200).json({ message: 'Times limpos.' });
});

app.post('/api/jogadores/reset', (req, res) => {
    fs.readdir(UPLOADS_DIR, (err, files) => {
        if (err) console.error("Erro ao ler diretório de uploads:", err);
        if (files) {
            for (const file of files) {
                if(file === '.gitkeep') continue;
                fs.unlink(path.join(UPLOADS_DIR, file), err => {
                    if (err) console.error(`Erro ao deletar ${file}:`, err);
                });
            }
        }
    });

    writeJogadores([]);
    writePagamentos({ valorChurrascoBase: 0, pagamentosJogadores: {} });
    writeTimeDoMes({ time1: { goleiro: null, linha: [], reservas: [] }, time2: { goleiro: null, linha: [], reservas: [] }});
    
    res.status(200).json({ message: 'Todos os jogadores, pagamentos e times foram removidos.' });
});

// --- Iniciar Servidor ---
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});