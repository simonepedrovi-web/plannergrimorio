// sw.js - VERSÃO AJUSTADA COM SINCRONIZAÇÃO

// Manter suas funções originais
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  self.clients.claim();
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const urlDestino = self.registration.scope;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.startsWith(urlDestino) && 'focus' in client) {
          return client.focus();
        }
      }

      return clients.openWindow(urlDestino);
    })
  );
});

// ===== ADICIONAR APENAS A SINCRONIZAÇÃO =====

const SYNC_TAG = 'grimorio-sync';

// 1. Adicionar evento de sincronização
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    console.log('🔄 Service Worker: Sincronização solicitada');
    event.waitUntil(sincronizarDados());
  }
});

// 2. Adicionar evento de mensagem
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SYNC_REQUEST':
      console.log('📡 Service Worker: Recebida solicitação de sincronização');
      event.waitUntil(sincronizarDados().then(() => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true });
        }
      }));
      break;
      
    case 'GET_DATA':
      obterDadosLocalStorage().then(dados => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true, data: dados });
        }
      });
      break;
      
    case 'STORE_DATA':
      salvarDadosNoLocalStorage(data).then(() => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true });
        }
      });
      break;
  }
});

// ===== FUNÇÕES DE SINCRONIZAÇÃO =====

// Função principal de sincronização
async function sincronizarDados() {
  try {
    console.log('📤 Service Worker: Coletando dados para sincronizar...');
    
    // 1. Obter dados do localStorage (via cliente)
    const dados = await obterDadosDoCliente();
    
    if (!dados || Object.keys(dados).length === 0) {
      console.log('📭 Service Worker: Nenhum dado para sincronizar');
      return;
    }
    
    // 2. Salvar dados temporariamente (IndexedDB ou cache)
    await salvarDadosTemporariamente(dados);
    
    // 3. Notificar todas as janelas/abas do app
    await notificarClientes(dados);
    
    console.log('✅ Service Worker: Sincronização concluída');
    
  } catch (error) {
    console.error('❌ Service Worker: Erro na sincronização:', error);
  }
}

// Obter dados do cliente (página web)
async function obterDadosDoCliente() {
  return new Promise((resolve, reject) => {
    // Enviar mensagem para obter dados
    const messageChannel = new MessageChannel();
    
    messageChannel.port1.onmessage = (event) => {
      if (event.data.success) {
        resolve(event.data.data);
      } else {
        reject(event.data.error);
      }
    };
    
    // Encontrar cliente para pedir os dados
    clients.matchAll().then((clientList) => {
      if (clientList.length > 0) {
        clientList[0].postMessage(
          { type: 'REQUEST_DATA_FOR_SYNC' },
          [messageChannel.port2]
        );
      } else {
        reject('Nenhum cliente disponível');
      }
    });
  });
}

// Salvar dados temporariamente (para recuperação)
async function salvarDadosTemporariamente(dados) {
  try {
    // Usar Cache API para armazenar temporariamente
    const cache = await caches.open('grimorio-sync-cache');
    const resposta = new Response(JSON.stringify(dados), {
      headers: { 'Content-Type': 'application/json' }
    });
    
    await cache.put('/sync-data', resposta);
    console.log('💾 Service Worker: Dados salvos no cache temporário');
    
  } catch (error) {
    console.warn('⚠️ Service Worker: Não foi possível salvar no cache:', error);
  }
}

// Notificar todos os clientes (abas) sobre a sincronização
async function notificarClientes(dados) {
  const clientList = await clients.matchAll({ includeUncontrolled: true });
  
  clientList.forEach(client => {
    client.postMessage({
      type: 'SYNC_DATA_AVAILABLE',
      data: dados,
      timestamp: new Date().toISOString(),
      source: 'service-worker'
    });
  });
  
  console.log(`📢 Service Worker: Notificados ${clientList.length} clientes`);
}

// Função auxiliar: Obter dados do localStorage (alternativa)
async function obterDadosLocalStorage() {
  // Esta função só funciona se chamada do contexto do cliente
  return new Promise((resolve) => {
    // Dados simulados - na prática viriam do cliente
    resolve({
      syncTime: new Date().toISOString(),
      status: 'ready'
    });
  });
}

// Função auxiliar: Salvar dados no localStorage (alternativa)
async function salvarDadosNoLocalStorage(dados) {
  return new Promise((resolve) => {
    console.log('📥 Service Worker: Dados para salvar:', dados);
    resolve();
  });
}

// ===== FUNÇÃO DE RECUPERAÇÃO =====
// Para quando o app for aberto offline
async function getStoredSyncData() {
  try {
    const cache = await caches.open('grimorio-sync-cache');
    const response = await cache.match('/sync-data');
    
    if (response) {
      const dados = await response.json();
      return dados;
    }
  } catch (error) {
    console.error('❌ Service Worker: Erro ao recuperar dados:', error);
  }
  return null;
}
