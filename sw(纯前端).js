// 缓存的名称
const cacheName = 'pwa-cache-v0.0.1';
// 需要缓存的文件
const filesToCache = [
	// '/index.html',
	// '/pwa.html'
];
// 监听安装事件
self.addEventListener('install', function(event) {
	console.log('Service Worker 安装成功');
	event.waitUntil(
		caches.open(cacheName)
		.then(function(cache) {
			return cache.addAll(filesToCache);
		})
	);
});
// 请求拦截器，不仅仅限于接口请求，所有的资源请求
self.addEventListener('fetch', function(e) {
	// console.log('Service Worker 拦截到请求:', event.request);
	e.respondWith(
		caches.match(e.request).then(function(cache) {
			return cache || fetch(e.request);
		}).catch(function(err) {
			console.log(err);
			return fetch(e.request);
		})
	);
});

self.addEventListener('activate', function(event) {
	console.log('Service Worker 激活成功');
	event.waitUntil(
		caches.keys().then(function(cacheNames) {
			return Promise.all(
				cacheNames.filter(function(cache) {
					// 清理旧版本缓存
					return cache.startsWith('pwa-cache-') && cache !== cacheName;
				}).map(function(cacheName) {
					return caches.delete(cacheName);
				})
			);
		})
	);
});
// 监听 push 事件并显示通知
self.addEventListener('push', function(event) {
	var payload = event.data ? JSON.parse(event.data.text()) : 'no payload';
	var title = 'Progressive Times';
	event.waitUntil(
		self.registration.showNotification(title, {
			body: payload.msg,
			url: payload.url,
			icon: payload.icon,
			actions: [{
					action: 'voteup',
					title: '𑠀 Vote Up'
				},
				{
					action: 'votedown',
					title: '𑠀 Vote Down'
				}
			],
			vibrate: [300, 100, 400]
		})
	);
});
// 点击通知
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({
      type: "window"
    })
    .then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url == '/' && 'focus' in client)
          return client.focus();
      }
      if (clients.openWindow) {
        return clients.openWindow('http://localhost:3111');
      }
    })
  );
});

// 请求通知权限
if (typeof window !== 'undefined' && 'Notification' in window) {
	Notification.requestPermission().then(function(permission) {
	  if (permission === 'granted') {
	    console.log('Notification permission granted.');
	    // 订阅推送服务
	    subscribeUser();
	  } else {
	    console.log('Notification permission denied.');
	  }
	});	
} else {
    console.log('This browser does not support notifications.');
}


// 订阅推送服务以获取推送凭证，并将其发送到你的服务器。
function subscribeUser() {
	navigator.serviceWorker.ready.then(function(registration) {
		const applicationServerKey = urlBase64ToUint8Array('<Your VAPID Public Key>');
		registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: applicationServerKey
		}).then(function(subscription) {
			console.log('User is subscribed:', subscription);
			// 将订阅对象发送到服务器
			// sendSubscriptionToServer(subscription);
		}).catch(function(error) {
			console.log('Failed to subscribe the user:', error);
		});
	});
}

function urlBase64ToUint8Array(base64String) {
	const padding = '='.repeat((4 - base64String.length % 4) % 4);
	const base64 = (base64String + padding)
		.replace(/\-/g, '+')
		.replace(/_/g, '/');
	const rawData = window.atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}