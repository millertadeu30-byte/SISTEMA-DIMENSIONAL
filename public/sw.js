// Service Worker Autodestrutivo / Limpador de Cache
// Isso força o navegador a deletar caches antigos e buscar a nova versão direto da rede.

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Não interceptamos mais nenhum fetch para garantir que o navegador sempre pegue os arquivos atualizados da rede

