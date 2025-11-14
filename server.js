const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));
app.use(express.json());
app.use(cookieParser());

// --- Configuração MongoDB (Modelos) ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Conectado ao MongoDB Atlas'))
    .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

const jogadorSchema = new mongoose.Schema({
    id: { type: Number, unique: true, index: true },
    nome: String,
    isGoleiro: Boolean,
    foto: String,
    fotoPublicId: String
});
const Jogador = mongoose.model('Jogador', jogadorSchema);

const caixinhaSchema = new mongoose.Schema({
    docId: { type: String, default: 'main', unique: true },
    saldoTotal: { type: Number, default: 0 },
    transacoes: [{
        id: Number,
        data: String,
        descricao: String,
        valor: Number,
        tipo: String,
        jogadorId: String,
        jogadorNome: String
    }]
});
const Caixinha = mongoose.model('Caixinha', caixinhaSchema);

const pagamentosSchema = new mongoose.Schema({
    docId: { type: String, default: 'main', unique: true },
    valorChurrascoBase: { type: Number, default: 0 },
    pagamentosJogadores: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} }
});
const Pagamentos = mongoose.model('Pagamentos', pagamentosSchema);

const timeDoMesSchema = new mongoose.Schema({
    docId: { type: String, default: 'main', unique: true },
    time1: { goleiro: Number, linha: [Number], reservas: [Number] },
    time2: { goleiro: Number, linha: [Number], reservas: [Number] }
});
const TimeDoMes = mongoose.model('TimeDoMes', timeDoMesSchema);

const findOrCreate = async (model, defaultData) => {
    let doc = await model.findOne({ docId: 'main' });
    if (!doc) {
        doc = await model.create(defaultData);
    }
    return doc;
};

// --- Configuração Cloudinary ---
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'ProjetoFutebol',
        format: async (req, file) => 'jpg',
        public_id: (req, file) => `jogador_${Date.now()}`,
    },
});
const upload = multer({ storage: storage });

// --- Middleware de Proteção ---
const protect = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ message: 'Acesso negado' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.clearCookie('token');
        return res.status(401).json({ message: 'Token inválido' });
    }
};

// --- Rotas de Páginas ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/pagamentos', (req, res) => res.sendFile(path.join(__dirname, 'pagamentos.html')));
app.get('/caixinha', (req, res) => res.sendFile(path.join(__dirname, 'caixinha.html')));
app.get('/jogadores', (req, res) => res.sendFile(path.join(__dirname, 'jogadores.html')));
app.get('/time-do-mes', (req, res) => res.sendFile(path.join(__dirname, 'time-do-mes.html')));

// --- Rotas de Autenticação ---
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, {
            expiresIn: '1d'
        });
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000
        });
        return res.status(200).json({ message: 'Login com sucesso' });
    } else {
        return res.status(401).json({ message: 'Senha incorreta' });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.status(200).json({ message: 'Logout com sucesso' });
});

app.get('/api/check-auth', protect, (req, res) => {
    res.status(200).json({ admin: true });
});

// --- API de Jogadores (Protegida) ---
app.get('/api/jogadores', async (req, res) => {
    const jogadores = await Jogador.find().sort({ nome: 1 });
    res.json(jogadores);
});

app.post('/api/jogadores', protect, upload.single('foto'), async (req, res) => {
    const novoJogador = new Jogador({
        id: Date.now(),
        nome: req.body.nome,
        isGoleiro: req.body.isGoleiro === 'true',
        foto: req.file ? req.file.path : '',
        fotoPublicId: req.file ? req.file.filename : null
    });
    await novoJogador.save();
    res.status(201).json(novoJogador);
});

app.put('/api/jogadores/:id', protect, upload.single('foto'), async (req, res) => {
    const jogadorId = Number(req.params.id);
    const jogador = await Jogador.findOne({ id: jogadorId });
    if (!jogador) return res.status(404).json({ message: 'Jogador não encontrado' });

    if (req.file) {
        if (jogador.fotoPublicId) {
            await cloudinary.uploader.destroy(jogador.fotoPublicId);
        }
        jogador.foto = req.file.path;
        jogador.fotoPublicId = req.file.filename;
    }
    jogador.nome = req.body.nome || jogador.nome;
    jogador.isGoleiro = req.body.isGoleiro === 'true';
    await jogador.save();
    res.status(200).json(jogador);
});

app.delete('/api/jogadores/:id', protect, async (req, res) => {
    const jogadorId = Number(req.params.id);
    const jogador = await Jogador.findOneAndDelete({ id: jogadorId });
    if (!jogador) return res.status(404).json({ message: 'Jogador não encontrado' });
    if (jogador.fotoPublicId) {
        await cloudinary.uploader.destroy(jogador.fotoPublicId);
    }
    res.status(200).json({ message: 'Jogador removido com sucesso' });
});

// --- API do Time do Mês (Protegida) ---
app.get('/api/time-do-mes', async (req, res) => {
    res.json(await findOrCreate(TimeDoMes, { docId: 'main', time1: {}, time2: {} }));
});
app.post('/api/time-do-mes', protect, async (req, res) => {
    const data = req.body;
    await TimeDoMes.findOneAndUpdate({ docId: 'main' }, data, { upsert: true });
    res.status(200).json({ message: 'Times salvos com sucesso!' });
});

// --- API da Caixinha (Protegida) ---
app.get('/api/caixinha', async (req, res) => {
    res.json(await findOrCreate(Caixinha, { docId: 'main', saldoTotal: 0, transacoes: [] }));
});
app.post('/api/caixinha', protect, async (req, res) => {
    const caixinhaData = await findOrCreate(Caixinha, { docId: 'main', saldoTotal: 0, transacoes: [] });
    const novaTransacao = req.body;
    novaTransacao.id = Date.now();
    novaTransacao.data = new Date().toISOString();
    if (novaTransacao.tipo === 'entrada') {
        caixinhaData.saldoTotal += novaTransacao.valor;
    } else {
        caixinhaData.saldoTotal -= novaTransacao.valor;
    }
    caixinhaData.transacoes.unshift(novaTransacao);
    await caixinhaData.save();
    res.status(201).json(caixinhaData);
});

// --- APIs de Pagamentos (Protegida) ---
app.get('/api/pagamentos', async (req, res) => {
    res.json(await findOrCreate(Pagamentos, { docId: 'main', valorChurrascoBase: 0, pagamentosJogadores: {} }));
});
app.post('/api/pagamentos/config', protect, async (req, res) => {
    const { valorChurrascoBase } = req.body;
    const pagamentos = await Pagamentos.findOneAndUpdate(
        { docId: 'main' },
        { valorChurrascoBase: parseFloat(valorChurrascoBase) || 0 },
        { new: true, upsert: true }
    );
    res.status(200).json(pagamentos);
});

app.post('/api/pagamentos/pagar', protect, async (req, res) => {
    const { jogadorId, jogadorNome, tipo, valor } = req.body;
    
    if (tipo === 'mensalidade') {
        const jogador = await Jogador.findOne({ id: Number(jogadorId) });
        if (jogador && jogador.isGoleiro) {
            return res.status(400).json({ message: 'Goleiros são isentos da mensalidade.' });
        }
    }
    
    const pagamentos = await findOrCreate(Pagamentos, { docId: 'main', valorChurrascoBase: 0, pagamentosJogadores: {} });
    if (pagamentos.pagamentosJogadores.get(String(jogadorId))?.[tipo]) {
        return res.status(400).json({ message: 'Este jogador já pagou esta taxa.' });
    }

    const caixinhaData = await findOrCreate(Caixinha, { docId: 'main', saldoTotal: 0, transacoes: [] });
    const novaTransacao = {
        id: Date.now(), data: new Date().toISOString(),
        descricao: tipo === 'mensalidade' ? 'Pagamento Mensalidade' : 'Pagamento Churrasco',
        valor: parseFloat(valor), tipo: 'entrada', jogadorId: jogadorId, jogadorNome: jogadorNome
    };
    caixinhaData.saldoTotal += novaTransacao.valor;
    caixinhaData.transacoes.unshift(novaTransacao);
    await caixinhaData.save();

    if (!pagamentos.pagamentosJogadores.get(String(jogadorId))) {
        pagamentos.pagamentosJogadores.set(String(jogadorId), {});
    }
    pagamentos.pagamentosJogadores.get(String(jogadorId))[tipo] = novaTransacao.id;
    pagamentos.markModified('pagamentosJogadores');
    await pagamentos.save();

    res.status(200).json({ pagamentos, caixinha: caixinhaData });
});

// --- Rotas de Cancelar e Resetar (Protegida) ---
app.post('/api/pagamentos/cancelar', protect, async (req, res) => {
    const { jogadorId, tipo } = req.body;
    const pagamentos = await findOrCreate(Pagamentos, { docId: 'main', valorChurrascoBase: 0, pagamentosJogadores: {} });
    
    const pagamentosDoJogador = pagamentos.pagamentosJogadores.get(String(jogadorId));
    if (!pagamentosDoJogador || !pagamentosDoJogador[tipo]) {
        return res.status(404).json({ message: 'Pagamento não encontrado.' });
    }
    
    const transacaoId = pagamentosDoJogador[tipo];
    const caixinhaData = await findOrCreate(Caixinha, { docId: 'main', saldoTotal: 0, transacoes: [] });
    
    const transacaoIndex = caixinhaData.transacoes.findIndex(t => t.id === transacaoId);
    if (transacaoIndex === -1) {
        pagamentosDoJogador[tipo] = null;
        pagamentos.markModified('pagamentosJogadores');
        await pagamentos.save();
        return res.status(404).json({ message: 'Transação na caixinha não encontrada, mas pagamento foi resetado.' });
    }
    
    const transacaoRemovida = caixinhaData.transacoes.splice(transacaoIndex, 1)[0];
    caixinhaData.saldoTotal -= transacaoRemovida.valor;
    await caixinhaData.save();
    
    pagamentosDoJogador[tipo] = null;
    pagamentos.markModified('pagamentosJogadores');
    await pagamentos.save();
    
    res.status(200).json({ pagamentos, caixinha: caixinhaData });
});

app.post('/api/pagamentos/reset', protect, async (req, res) => {
    const pagamentos = await Pagamentos.findOneAndUpdate(
        { docId: 'main' },
        { pagamentosJogadores: {} },
        { new: true, upsert: true }
    );
    res.status(200).json(pagamentos);
});

app.post('/api/caixinha/reset', protect, async (req, res) => {
    await Caixinha.findOneAndUpdate(
        { docId: 'main' },
        { saldoTotal: 0, transacoes: [] },
        { new: true, upsert: true }
    );
    res.status(200).json({ message: 'Caixinha zerada.' });
});

app.post('/api/time-do-mes/reset', protect, async (req, res) => {
    await TimeDoMes.findOneAndUpdate(
        { docId: 'main' },
        { time1: { goleiro: null, linha: [], reservas: [] }, time2: { goleiro: null, linha: [], reservas: [] } },
        { new: true, upsert: true }
    );
    res.status(200).json({ message: 'Times limpos.' });
});

app.post('/api/jogadores/reset', protect, async (req, res) => {
    const jogadores = await Jogador.find();
    for (const jogador of jogadores) {
        if (jogador.fotoPublicId) {
            await cloudinary.uploader.destroy(jogador.fotoPublicId);
        }
    }
    await Jogador.deleteMany({});
    await Pagamentos.deleteMany({});
    await TimeDoMes.deleteMany({});
    
    res.status(200).json({ message: 'Todos os jogadores, pagamentos e times foram removidos.' });
});

// --- Iniciar Servidor ---
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});