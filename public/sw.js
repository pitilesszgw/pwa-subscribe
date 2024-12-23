/**
 * service worker
 */
var cacheName = 'bs-999';
var apiCacheName = 'api-0-1-1';
var cacheFiles = [
    '/',
    './index.html',
    './base64util.js',
    './index.js',
    './style.css',
    './img/weather.png',
    './img/loading.svg'
];

// 监听install事件，安装完成后，进行文件缓存
self.addEventListener('install', function (e) {
    console.log('Service Worker 状态： install');
    var cacheOpenPromise = caches.open(cacheName).then(function (cache) {
        return cache.addAll(cacheFiles);
    });
    e.waitUntil(cacheOpenPromise);
});

// 监听activate事件，激活后通过cache的key来判断是否更新cache中的静态资源
self.addEventListener('activate', function (e) {
    console.log('Service Worker 状态： activate');
    var cachePromise = caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (key) {
            if (key !== cacheName && key !== apiCacheName) {
                return caches.delete(key);
            }
        }));
    })
    e.waitUntil(cachePromise);
    // 注意不能忽略这行代码，否则第一次加载会导致fetch事件不触发
    return self.clients.claim();
});

self.addEventListener('fetch', function (e) {
    console.log('e.request.url', e.request.url)
    // 需要缓存的xhr请求
    var cacheRequestUrls = [
        '/current?'
    ];
    console.log('现在正在请求：' + e.request.url);

    // 判断当前请求是否需要缓存
    var needCache = cacheRequestUrls.some(function (url) {
        return e.request.url.indexOf(url) > -1;
    });

    if (needCache) {
        // 需要缓存
        // 使用fetch请求数据，并将请求结果clone一份缓存到cache
        // 此部分缓存后在browser中使用全局变量caches获取
        caches.open(apiCacheName).then(function (cache) {
            return fetch(e.request).then(function (response) {
                cache.put(e.request.url, response.clone());
                return response;
            });
        });
    }
    else {
        // 非api请求，直接查询cache
        // 如果有cache则直接返回，否则通过fetch请求
        e.respondWith(
            caches.match(e.request).then(function (cache) {
                return cache || fetch(e.request);
            }).catch(function (err) {
                console.log(err);
                return fetch(e.request);
            })
        );
    }
});

/* ============== */
/* push处理相关部分 */
/* ============== */
// 添加service worker对push的监听
self.addEventListener('push', function (e) {
    var data = e.data;
    if (e.data) {
        data = data.json();
        console.log('push的数据为：', data);
        self.registration.showNotification(data.text,{
            body: data.body,
			url: 'https:bilibili.com',
			icon: data.icon,
            actions: [{
                action: 'show-7',
                title: '查看近七天天气'
                }, {
                action: 'show-all',
                title: '查看所有天气'
            }],
            vibrate: [300, 100, 400]
        });        
    } 
    else {
        console.log('push没有任何数据');
    }
});
/* ============== */

// sw.js
self.addEventListener('notificationclick', function (e) {
    console.log('e', e)
    var action = e.action;
    console.log(`action tag: ${e.notification.tag}`, `action: ${action}`);

    switch (action) {
        case 'show-7':
            console.log('show-7');
            break;
        case 'show-all':
            console.log('show-all');
            break;
        default:
            console.log(`未处理的action: ${e.action}`);
            action = 'default';
            break;
    }
    e.notification.close();

    e.waitUntil(
        // 获取所有clients
        self.clients.matchAll().then(function (clients) {
            if (!clients || clients.length === 0) {
                // 当不存在client时，打开该网站
                self.clients.openWindow && self.clients.openWindow('http://127.0.0.1:8085');
                return;
            }
            // 切换到该站点的tab
            clients[0].focus && clients[0].focus();
            clients.forEach(function (client) {
                // 使用postMessage进行通信
                client.postMessage(action);
            });
        })
    );
});