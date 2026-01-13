// sw.js
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = new URL('./', self.location.origin).href;
  
  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Verifica se já existe uma janela/tab aberta
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Se não existe, abre uma nova janela
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Adiciona suporte para notificações push (opcional para funcionalidades futuras)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'Nova notificação do Grimório',
      icon: data.icon || 'icon-192.png',
      badge: 'icon-192.png',
      tag: data.tag || 'grimorio-notification',
      data: data.data || {}
    };
    
    event.waitUntil(
      self.registration.showNotification(
        data.title || 'Grimório Ritualístico',
        options
      )
    );
  } catch (error) {
    console.error('Erro ao processar notificação push:', error);
  }
});
