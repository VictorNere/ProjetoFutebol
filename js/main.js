document.addEventListener('DOMContentLoaded', () => {
    // --- LÓGICA GLOBAL (Toast, Navegação) ---
    const navLinks = document.querySelectorAll('.main-nav .nav-link');
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    navLinks.forEach(link => {
        const linkPage = link.getAttribute('href').split('/').pop();
        if (linkPage === currentPage) {
            link.classList.add('active');
        }
    });

    const toastContainer = document.getElementById('toast-container');
    const showToast = (message, type = 'success') => {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.classList.add('toast', type);
        toast.textContent = message;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    };
    
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    // --- LÓGICA DO MODAL DE CONFIRMAÇÃO (CORRIGIDA) ---
    let confirmCallback = null;

    const openConfirmModal = (text, callback) => {
        const confirmModal = document.getElementById('confirm-modal');
        const confirmBackdrop = document.getElementById('confirm-backdrop');
        const confirmText = document.getElementById('confirm-modal-text');

        // VERIFICA SE O MODAL EXISTE NA PÁGINA
        if (!confirmModal || !confirmBackdrop || !confirmText) {
            console.error('Modal de confirmação não encontrado no HTML desta página.');
            // Fallback para o alert feio se o HTML estiver quebrado
            if (confirm(text)) {
                callback();
            }
            return;
        }

        confirmText.textContent = text;
        confirmCallback = callback;
        confirmBackdrop.style.display = 'block';
        confirmModal.style.display = 'block';
    };

    const closeConfirmModal = () => {
        const confirmModal = document.getElementById('confirm-modal');
        const confirmBackdrop = document.getElementById('confirm-backdrop');
        
        if (confirmModal) confirmModal.style.display = 'none';
        if (confirmBackdrop) confirmBackdrop.style.display = 'none';
        confirmCallback = null;
    };

    // Adiciona listeners globais de forma segura
    const btnConfirmNo = document.getElementById('btn-confirm-no');
    const btnConfirmYes = document.getElementById('btn-confirm-yes');
    const globalConfirmBackdrop = document.getElementById('confirm-backdrop');

    if (btnConfirmNo) btnConfirmNo.addEventListener('click', closeConfirmModal);
    if (globalConfirmBackdrop) globalConfirmBackdrop.addEventListener('click', closeConfirmModal);
    if (btnConfirmYes) btnConfirmYes.addEventListener('click', () => {
        if (confirmCallback) {
            confirmCallback();
        }
        closeConfirmModal();
    });

    // --- LÓGICA DA PÁGINA DE JOGADORES ---
    const formAddJogador = document.getElementById('form-add-jogador');
    const listaJogadoresEl = document.getElementById('lista-jogadores');
    
    if (formAddJogador && listaJogadoresEl) {
        
        const fileInput = document.getElementById('foto-jogador');
        const cropModal = document.getElementById('cropper-modal');
        const cropBackdrop = document.getElementById('cropper-backdrop');
        const imageToCrop = document.getElementById('img-to-crop');
        const confirmCropBtn = document.getElementById('btn-confirm-crop');
        const btnResetJogadores = document.getElementById('btn-reset-jogadores');
        
        let cropper;
        let croppedImageBlob = null;
        const aspectRatio = 200 / 180;

        const openCropModal = () => {
            cropBackdrop.style.display = 'block';
            cropModal.style.display = 'block';
        };

        const closeCropModal = () => {
            cropBackdrop.style.display = 'none';
            cropModal.style.display = 'none';
            if (cropper) cropper.destroy();
            cropper = null;
            fileInput.value = '';
        };

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file || !file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                imageToCrop.src = event.target.result;
                openCropModal();
                cropper = new Cropper(imageToCrop, {
                    aspectRatio: aspectRatio, viewMode: 1, dragMode: 'move',
                    background: false, cropBoxResizable: false, cropBoxMovable: false,
                });
            };
            reader.readAsDataURL(file);
        });

        confirmCropBtn.addEventListener('click', () => {
            if (!cropper) return;
            const canvas = cropper.getCroppedCanvas({ width: 400, height: 400 / aspectRatio });
            canvas.toBlob((blob) => {
                croppedImageBlob = blob;
                closeCropModal();
                showToast('Imagem recortada!', 'success');
            }, 'image/jpeg', 0.9);
        });
        
        if (cropBackdrop) cropBackdrop.addEventListener('click', closeCropModal);

        const criarCardJogador = (jogador) => {
            const card = document.createElement('div');
            card.classList.add('player-card');
            if (jogador.isGoleiro) card.classList.add('goleiro');
            card.dataset.id = jogador.id;
            const fotoUrl = jogador.foto ? jogador.foto : 'https://via.placeholder.com/200x180.png?text=Sem+Foto';

            card.innerHTML = `
                <button class="btn-remover-jogador">X</button>
                <div class="card-image-wrapper">
                    <img src="${fotoUrl}" alt="${jogador.nome}">
                    <span class="player-name">${jogador.nome}</span>
                </div>
                <div class="card-info">
                    <div class="player-details">
                        <span class="player-gk-icon">${jogador.isGoleiro ? '🧤' : ''}</span>
                    </div>
                </div>`;
            
            card.querySelector('.btn-remover-jogador').addEventListener('click', () => {
                openConfirmModal(`Tem certeza que deseja remover o jogador "${jogador.nome}"?`, async () => {
                    try {
                        const response = await fetch(`/api/jogadores/${jogador.id}`, { method: 'DELETE' });
                        if (!response.ok) throw new Error('Falha ao remover jogador');
                        card.remove();
                        showToast('Jogador removido com sucesso!', 'success');
                    } catch (error) {
                        showToast('Não foi possível remover o jogador.', 'error');
                    }
                });
            });
            listaJogadoresEl.appendChild(card);
        };

        const carregarJogadores = async () => {
            try {
                const response = await fetch('/api/jogadores');
                if (!response.ok) throw new Error('Falha ao buscar jogadores');
                const jogadores = await response.json();
                listaJogadoresEl.innerHTML = '';
                jogadores.forEach(jogador => criarCardJogador(jogador));
            } catch (error) {
                console.error('Erro:', error);
                showToast('Falha ao carregar jogadores.', 'error');
            }
        };

        formAddJogador.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!croppedImageBlob) {
                showToast('Por favor, selecione e confirme o recorte da imagem.', 'error');
                return;
            }
            const formData = new FormData();
            formData.append('nome', document.getElementById('nome-jogador').value);
            formData.append('isGoleiro', document.getElementById('goleiro-jogador').checked);
            formData.append('foto', croppedImageBlob, 'jogador.jpg');

            try {
                const response = await fetch('/api/jogadores', { method: 'POST', body: formData });
                if (!response.ok) throw new Error('Falha ao adicionar jogador');
                const jogadorSalvo = await response.json();
                criarCardJogador(jogadorSalvo);
                formAddJogador.reset();
                croppedImageBlob = null;
                showToast('Jogador adicionado com sucesso!', 'success');
            } catch (error) {
                console.error('Erro:', error);
                showToast('Falha ao adicionar jogador.', 'error');
            }
        });
        
        btnResetJogadores.addEventListener('click', () => {
            openConfirmModal("TEM CERTEZA? Isso vai apagar TODOS os jogadores, fotos, pagamentos e times. Esta ação não pode ser desfeita.", async () => {
                try {
                    const response = await fetch('/api/jogadores/reset', { method: 'POST' });
                    if (!response.ok) throw new Error('Falha ao resetar jogadores');
                    carregarJogadores(); // Recarrega a lista (vazia)
                    showToast('Todos os jogadores e dados foram removidos.', 'success');
                } catch (error) {
                    showToast('Erro ao resetar jogadores.', 'error');
                }
            });
        });
        
        carregarJogadores();
    }

    // --- LÓGICA DO TIME DO MÊS ---
    const teamBuilderContainer = document.getElementById('team-builder-container');
    if (teamBuilderContainer) {
        
        let todosJogadores = [];
        let timeDoMes = {};
        let draggedPlayer = null;

        const poolDisponiveis = document.getElementById('pool-disponiveis');
        const allDropZones = document.querySelectorAll('.drop-zone');
        const btnSalvarTimes = document.getElementById('btn-salvar-times');
        const btnLimparTimes = document.getElementById('btn-limpar-times');
        const btnGerarTimes = document.getElementById('btn-gerar-times');

        const getJogadorById = (id) => todosJogadores.find(j => j.id == id);

        const createPlayerPill = (jogador) => {
            const pill = document.createElement('div');
            pill.classList.add('player-pill');
            pill.dataset.id = jogador.id;
            pill.dataset.isGoleiro = jogador.isGoleiro;
            pill.textContent = jogador.nome;
            pill.draggable = true;
            if (jogador.isGoleiro) {
                pill.classList.add('goleiro-pill');
                pill.textContent = '🧤 ' + jogador.nome;
            }
            pill.addEventListener('dragstart', (e) => {
                draggedPlayer = e.target;
                setTimeout(() => pill.style.display = 'none', 0);
            });
            pill.addEventListener('dragend', () => {
                draggedPlayer = null;
                pill.style.display = 'flex';
            });
            return pill;
        };

        const renderTimes = () => {
            allDropZones.forEach(zone => zone.innerHTML = '');
            let assignedPlayerIds = [];
            const populateSlot = (slotId, playerIds) => {
                const slot = document.getElementById(slotId);
                if (!slot || !playerIds) return;
                const ids = Array.isArray(playerIds) ? playerIds : [playerIds];
                ids.forEach(id => {
                    if (!id) return;
                    const jogador = getJogadorById(id);
                    if (jogador) {
                        slot.appendChild(createPlayerPill(jogador));
                        assignedPlayerIds.push(jogador.id); // Certifica que é o ID
                    }
                });
            };
            populateSlot('time1-goleiro', timeDoMes.time1.goleiro);
            populateSlot('time1-linha', timeDoMes.time1.linha);
            populateSlot('time1-reservas', timeDoMes.time1.reservas);
            populateSlot('time2-goleiro', timeDoMes.time2.goleiro);
            populateSlot('time2-linha', timeDoMes.time2.linha);
            populateSlot('time2-reservas', timeDoMes.time2.reservas);
            
            poolDisponiveis.innerHTML = '';
            todosJogadores.forEach(jogador => {
                if (!assignedPlayerIds.includes(jogador.id)) {
                    poolDisponiveis.appendChild(createPlayerPill(jogador));
                }
            });
        };
        
        allDropZones.forEach(zone => {
            zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
            zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('drag-over');
                if (!draggedPlayer) return;
                const isGoleiro = draggedPlayer.dataset.isGoleiro === 'true';
                const max = parseInt(zone.dataset.max) || 99;
                const pos = zone.dataset.pos;
                
                if (pos === 'goleiro' && !isGoleiro) { showToast('Apenas Goleiros podem ser movidos para este slot.', 'error'); return; }
                if (pos === 'linha' && isGoleiro) { showToast('Goleiros não podem jogar na linha.', 'error'); return; }
                if (zone.children.length >= max) { showToast('Este slot está cheio!', 'error'); return; }
                zone.appendChild(draggedPlayer);
            });
        });
        
        btnSalvarTimes.addEventListener('click', async () => {
            const getIdsFromSlot = (slot) => Array.from(slot.children).map(pill => Number(pill.dataset.id));
            const dataToSave = {
                time1: {
                    goleiro: getIdsFromSlot(document.getElementById('time1-goleiro'))[0] || null,
                    linha: getIdsFromSlot(document.getElementById('time1-linha')),
                    reservas: getIdsFromSlot(document.getElementById('time1-reservas'))
                },
                time2: {
                    goleiro: getIdsFromSlot(document.getElementById('time2-goleiro'))[0] || null,
                    linha: getIdsFromSlot(document.getElementById('time2-linha')),
                    reservas: getIdsFromSlot(document.getElementById('time2-reservas'))
                }
            };
            try {
                const response = await fetch('/api/time-do-mes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dataToSave)
                });
                if (!response.ok) throw new Error('Falha ao salvar');
                showToast('Escalação salva com sucesso!', 'success');
            } catch (error) {
                console.error(error);
                showToast('Erro ao salvar a escalação.', 'error');
            }
        });

        btnLimparTimes.addEventListener('click', () => {
            openConfirmModal("Limpar todas as escalações e mover todos os jogadores para 'Disponíveis'?", async () => {
                try {
                    const response = await fetch('/api/time-do-mes/reset', { method: 'POST' });
                    if (!response.ok) throw new Error('Falha ao limpar times');
                    init(); // Recarrega a página
                    showToast('Times limpos!', 'success');
                } catch (error) {
                    showToast('Erro ao limpar times.', 'error');
                }
            });
        });

        const shuffleArray = (array) => array.sort(() => Math.random() - 0.5);
        btnGerarTimes.addEventListener('click', () => {
            let goleirosDisponiveis = shuffleArray([...todosJogadores.filter(j => j.isGoleiro)]);
            let jogadoresDisponiveis = shuffleArray([...todosJogadores.filter(j => !j.isGoleiro)]);
            
            const slots = [
                { id: 'time1-goleiro', max: 1, pos: 'goleiro' },
                { id: 'time2-goleiro', max: 1, pos: 'goleiro' },
                { id: 'time1-linha', max: 5, pos: 'linha' },
                { id: 'time2-linha', max: 5, pos: 'linha' },
                { id: 'time1-reservas', max: 4, pos: 'reserva' },
                { id: 'time2-reservas', max: 4, pos: 'reserva' }
            ];

            allDropZones.forEach(zone => zone.innerHTML = '');
            let poolTemp = [...todosJogadores];

            slots.forEach(slot => {
                const zone = document.getElementById(slot.id);
                const source = (slot.pos === 'goleiro') ? goleirosDisponiveis : jogadoresDisponiveis;
                for (let i = 0; i < slot.max; i++) {
                    const jogador = source.pop();
                    if (jogador) {
                        zone.appendChild(createPlayerPill(jogador));
                        poolTemp = poolTemp.filter(p => p.id !== jogador.id);
                    }
                }
            });
            
            poolDisponiveis.innerHTML = '';
            poolTemp.forEach(jogador => poolDisponiveis.appendChild(createPlayerPill(jogador)));
            showToast('Times gerados aleatoriamente!', 'success');
        });

        const init = async () => {
            try {
                const [jogadoresRes, timeRes] = await Promise.all([
                    fetch('/api/jogadores'),
                    fetch('/api/time-do-mes')
                ]);
                if (!jogadoresRes.ok || !timeRes.ok) throw new Error('Falha ao carregar dados iniciais');
                todosJogadores = await jogadoresRes.json();
                timeDoMes = await timeRes.json();
                renderTimes();
            } catch (error) {
                console.error(error);
                showToast('Erro ao carregar a página.', 'error');
            }
        };
        init();
    }

    // --- LÓGICA DA CAIXINHA ---
    const formCaixinha = document.getElementById('form-caixinha');
    if (formCaixinha) {
        
        const saldoDisplay = document.getElementById('saldo-total-display');
        const histLista = document.getElementById('hist-transacoes-lista');
        const jogadorSelect = document.getElementById('transacao-jogador');
        const jogadorSelectGroup = document.getElementById('jogador-select-group');
        const tipoSelect = document.getElementById('transacao-tipo');
        const btnResetCaixinha = document.getElementById('btn-reset-caixinha');

        const updateUI = (data) => {
            if(saldoDisplay) saldoDisplay.textContent = formatCurrency(data.saldoTotal);
            if(histLista) histLista.innerHTML = '';
            
            data.transacoes.forEach(t => {
                const li = document.createElement('li');
                li.classList.add(t.tipo);
                const valorDisplay = t.tipo === 'entrada' ? `+ ${formatCurrency(t.valor)}` : `- ${formatCurrency(t.valor)}`;
                const dataFormatada = new Date(t.data).toLocaleDateString('pt-BR');
                const nomeJogador = t.jogadorNome ? ` (${t.jogadorNome})` : '';
                li.innerHTML = `
                    <div class="info">
                        <strong>${t.descricao}${nomeJogador}</strong>
                        <small>${dataFormatada}</small>
                    </div>
                    <span class="valor">${valorDisplay}</span>`;
                if(histLista) histLista.appendChild(li);
            });
        };

        const carregarJogadoresDropdown = async () => {
            try {
                const response = await fetch('/api/jogadores');
                if (!response.ok) throw new Error('Falha ao buscar jogadores');
                const jogadores = await response.json();
                jogadores.forEach(jogador => {
                    const option = document.createElement('option');
                    option.value = jogador.id;
                    option.textContent = jogador.nome;
                    if(jogadorSelect) jogadorSelect.appendChild(option);
                });
            } catch (error) {
                console.error(error);
                showToast('Não foi possível carregar a lista de jogadores.', 'error');
            }
        };

        const carregarCaixinha = async () => {
            try {
                const response = await fetch('/api/caixinha');
                if (!response.ok) throw new Error('Falha ao carregar caixinha');
                const data = await response.json();
                updateUI(data);
            } catch (error) {
                console.error(error);
                showToast('Erro ao carregar dados da caixinha.', 'error');
            }
        };

        if(tipoSelect) tipoSelect.addEventListener('change', () => {
            if (tipoSelect.value === 'saida') {
                jogadorSelectGroup.style.display = 'none';
                jogadorSelect.value = '';
            } else {
                jogadorSelectGroup.style.display = 'block';
            }
        });

        formCaixinha.addEventListener('submit', async (e) => {
            e.preventDefault();
            const descricao = document.getElementById('transacao-descricao').value;
            const valor = parseFloat(document.getElementById('transacao-valor').value);
            const tipo = document.getElementById('transacao-tipo').value;
            const jogadorId = document.getElementById('transacao-jogador').value;
            const jogadorNome = jogadorSelect.options[jogadorSelect.selectedIndex].text;
            
            const novaTransacao = {
                descricao, valor, tipo,
                jogadorId: tipo === 'entrada' ? jogadorId : null,
                jogadorNome: tipo === 'entrada' && jogadorId ? jogadorNome : null
            };

            try {
                const response = await fetch('/api/caixinha', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(novaTransacao)
                });
                if (!response.ok) throw new Error('Falha ao salvar transação');
                const dataAtualizada = await response.json();
                updateUI(dataAtualizada);
                formCaixinha.reset();
                if(jogadorSelectGroup) jogadorSelectGroup.style.display = 'block';
                showToast('Transação registrada com sucesso!', 'success');
            } catch (error) {
                console.error(error);
                showToast('Erro ao salvar transação.', 'error');
            }
        });
        
        if(btnResetCaixinha) btnResetCaixinha.addEventListener('click', () => {
            openConfirmModal("TEM CERTEZA? Isso vai apagar todo o histórico de transações e zerar o saldo.", async () => {
                try {
                    const response = await fetch('/api/caixinha/reset', { method: 'POST' });
                    if (!response.ok) throw new Error('Falha ao resetar caixinha');
                    carregarCaixinha();
                    showToast('Caixinha zerada com sucesso!', 'success');
                } catch (error) {
                    showToast('Erro ao zerar caixinha.', 'error');
                }
            });
        });

        carregarJogadoresDropdown();
        carregarCaixinha();
    }
    
    // --- LÓGICA DE PAGAMENTOS (ATUALIZADA) ---
    const pagamentosGrid = document.querySelector('.pagamentos-grid');
    if (pagamentosGrid) {
        
        const valorChurrascoInput = document.getElementById('valor-churrasco');
        const btnSalvarChurrasco = document.getElementById('btn-salvar-churrasco');
        const resumoJogadores = document.getElementById('resumo-jogadores');
        const resumoMensalidade = document.getElementById('resumo-mensalidade');
        const resumoChurrasco = document.getElementById('resumo-churrasco');
        const resumoArrecadado = document.getElementById('resumo-arrecadado');
        const tableBody = document.getElementById('pagamentos-table-body');
        const btnResetPagamentos = document.getElementById('btn-reset-pagamentos');
        
        const valorMensalidadeBase = 540;
        let todosJogadores = [];
        let pagamentosData = {};
        let valorMensalidadePorJogador = 0;

        const renderPagamentos = () => {
            tableBody.innerHTML = '';
            let totalArrecadado = 0;
            
            todosJogadores.forEach(jogador => {
                const status = pagamentosData.pagamentosJogadores[jogador.id] || { mensalidade: null, churrasco: null };
                
                // Botão Mensalidade
                let btnMensalidade;
                if (jogador.isGoleiro) {
                    btnMensalidade = `<button class="btn-pagamento isento" disabled>Isento</button>`;
                } else if (status.mensalidade) {
                    btnMensalidade = `<button class="btn-pagamento cancelar" data-tipo="mensalidade" data-id="${jogador.id}" data-valor="${valorMensalidadePorJogador}">Cancelar</button>`;
                    totalArrecadado += valorMensalidadePorJogador;
                } else {
                    btnMensalidade = `<button class="btn-pagamento pagar" data-tipo="mensalidade" data-id="${jogador.id}" data-nome="${jogador.nome}" data-valor="${valorMensalidadePorJogador}">Pagar ${formatCurrency(valorMensalidadePorJogador)}</button>`;
                }

                // Botão Churrasco
                let btnChurrasco;
                if (status.churrasco) {
                    btnChurrasco = `<button class="btn-pagamento cancelar" data-tipo="churrasco" data-id="${jogador.id}" data-valor="${pagamentosData.valorChurrascoBase}">Cancelar</button>`;
                    totalArrecadado += pagamentosData.valorChurrascoBase;
                } else {
                    btnChurrasco = `<button class="btn-pagamento pagar" data-tipo="churrasco" data-id="${jogador.id}" data-nome="${jogador.nome}" data-valor="${pagamentosData.valorChurrascoBase}">Pagar ${formatCurrency(pagamentosData.valorChurrascoBase)}</button>`;
                }
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${jogador.nome} ${jogador.isGoleiro ? '🧤' : ''}</td>
                    <td>${btnMensalidade}</td>
                    <td>${btnChurrasco}</td>
                `;
                tableBody.appendChild(tr);
            });
            
            resumoArrecadado.textContent = formatCurrency(totalArrecadado);
        };

        const updateResumo = () => {
            const jogadoresDeLinha = todosJogadores.filter(j => !j.isGoleiro).length;
            valorMensalidadePorJogador = jogadoresDeLinha > 0 ? valorMensalidadeBase / jogadoresDeLinha : 0;
            resumoJogadores.textContent = todosJogadores.length;
            resumoMensalidade.textContent = formatCurrency(valorMensalidadePorJogador);
            resumoChurrasco.textContent = formatCurrency(pagamentosData.valorChurrascoBase);
            valorChurrascoInput.value = pagamentosData.valorChurrascoBase.toFixed(2);
        };
        
        btnSalvarChurrasco.addEventListener('click', async () => {
            const novoValor = parseFloat(valorChurrascoInput.value);
            try {
                const response = await fetch('/api/pagamentos/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ valorChurrascoBase: novoValor })
                });
                if (!response.ok) throw new Error('Falha ao salvar valor');
                pagamentosData = await response.json();
                updateResumo();
                renderPagamentos();
                showToast('Valor do churrasco salvo!', 'success');
            } catch (error) {
                showToast('Erro ao salvar valor.', 'error');
            }
        });
        
        tableBody.addEventListener('click', async (e) => {
            const btn = e.target;
            const { id, nome, tipo, valor } = btn.dataset;
            
            if (btn.classList.contains('pagar')) {
                if (parseFloat(valor) <= 0) {
                    showToast('Defina um valor maior que zero para o pagamento.', 'error'); return;
                }
                btn.disabled = true; btn.textContent = 'Pagando...';
                
                try {
                    const response = await fetch('/api/pagamentos/pagar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ jogadorId: id, jogadorNome: nome, tipo, valor: parseFloat(valor) })
                    });
                    if (!response.ok) {
                        const err = await response.json(); throw new Error(err.message || 'Falha ao registrar pagamento');
                    }
                    const { pagamentos } = await response.json();
                    pagamentosData = pagamentos;
                    updateResumo(); renderPagamentos();
                    showToast('Pagamento registrado!', 'success');
                } catch (error) {
                    showToast(error.message, 'error');
                    // btn.disabled = false; // O renderPagamentos() vai recriar o botão
                }

            } else if (btn.classList.contains('cancelar')) {
                openConfirmModal(`Cancelar este pagamento? (Isso removerá ${formatCurrency(valor)} da caixinha)`, async () => {
                    btn.disabled = true; btn.textContent = 'Cancelando...';
                    try {
                        const response = await fetch('/api/pagamentos/cancelar', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ jogadorId: id, tipo })
                        });
                        if (!response.ok) {
                            const err = await response.json(); throw new Error(err.message || 'Falha ao cancelar');
                        }
                        const { pagamentos } = await response.json();
                        pagamentosData = pagamentos;
                        updateResumo(); renderPagamentos();
                        showToast('Pagamento cancelado!', 'success');
                    } catch (error) {
                        showToast(error.message, 'error');
                        // btn.disabled = false; // O renderPagamentos() vai recriar o botão
                    }
                });
            }
        });
        
        btnResetPagamentos.addEventListener('click', () => {
            openConfirmModal("Zerar TODOS os status de pagamento? (Isso NÃO afeta a caixinha).", async () => {
                try {
                    const response = await fetch('/api/pagamentos/reset', { method: 'POST' });
                    if (!response.ok) throw new Error('Falha ao zerar pagamentos');
                    pagamentosData = await response.json();
                    updateResumo(); renderPagamentos();
                    showToast('Pagamentos zerados!', 'success');
                } catch (error) {
                    showToast('Erro ao zerar pagamentos.', 'error');
                }
            });
        });

        const init = async () => {
            try {
                const [jogadoresRes, pagamentosRes] = await Promise.all([
                    fetch('/api/jogadores'),
                    fetch('/api/pagamentos')
                ]);
                if (!jogadoresRes.ok || !pagamentosRes.ok) throw new Error('Falha ao carregar dados');
                todosJogadores = await jogadoresRes.json();
                pagamentosData = await pagamentosRes.json();
                updateResumo();
                renderPagamentos();
            } catch (error) {
                showToast('Erro ao carregar a página.', 'error');
            }
        };
        init();
    }
});