(function() {
    let currentWeather = {}
    function renderDom(data) {
        currentWeather = data
        // 提取 API 返回的数据
        const location = data.location.name + ', ' + data.location.country;
        const condition = data.current.condition.text;
        const temperatureC = data.current.temp_c;
        const humidity = data.current.humidity;
        const windSpeed = data.current.wind_kph;
        const pressure = data.current.pressure_mb;
        const feelsLikeC = data.current.feelslike_c;
        const precip = data.current.precip_mm;
        const weatherIcon = 'https:' + data.current.condition.icon;

        // 插入数据到 DOM
        document.getElementById('location').textContent = location;
        document.getElementById('condition').textContent = condition;
        document.getElementById('temperature').textContent = `${temperatureC}°C`;
        document.getElementById('humidity').textContent = `湿度: ${humidity}%`;
        document.getElementById('wind').textContent = `风速: ${windSpeed} kph`;
        document.getElementById('pressure').textContent = `气压: ${pressure} hPa`;
        document.getElementById('feelslike').textContent = `体感温度: ${feelsLikeC}°C`;
        document.getElementById('precip').textContent = `降水量: ${precip} mm`;
        document.getElementById('weather-icon').src = weatherIcon;
    }

    searchEvent()

    function searchEvent() {
        var input = document.querySelector('#js-search-input');
        var query = input.value;
        var xhr = new XMLHttpRequest();
        var url = '/current?q=' + query;
        var cacheData;
        if (query === '') {
            alert('请输入关键词');
            return;
        }
        var remotePromise = getApiDataRemote(url);
        getApiDataFromCache(url).then(function (data) {
            console.log('data', data)       
            if (data) {
                input.blur();     
                renderDom(data);
            }
            cacheData = data || {};
            return remotePromise;
        }).then(function (data) {
            console.log('data2', data)
            if (JSON.stringify(data) !== JSON.stringify(cacheData)) {
                input.blur();
                renderDom(data);
            }
        });
    }

    /**
     * 监听“搜索”按钮点击事件
     */
    document.querySelector('#js-search-btn').addEventListener('click', function () {
        searchEvent();
    });

    /**
     * 监听“回车”事件
     */
    window.addEventListener('keypress', function (e) {
        if (e.keyCode === 13) {
            searchEvent();
        }
    });

    /**
     * 获取该请求的缓存数据
     * @param {string} url 请求的url
     * @return {Promise}
     */
    function getApiDataFromCache(url) {
        if ('caches' in window) {
            return caches.match(url).then(function (cache) {
                console.log('cache', cache)
                if (!cache) {
                    return;
                }
                return cache.json();
            });
        }
        else {
            return Promise.resolve();
        }
    }

    function getApiDataRemote(url) {
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.timeout = 60000;
            xhr.onreadystatechange = function () {
                var response = {};
                if (xhr.readyState === 4 && xhr.status === 200) {
                    try {
                        response = JSON.parse(xhr.responseText);
                    }
                    catch (e) {
                        response = xhr.responseText;
                    }
                    resolve(response);
                }
                else if (xhr.readyState === 4) {
                    resolve();
                }
            };
            xhr.onabort = reject;
            xhr.onerror = reject;
            xhr.ontimeout = reject;
            xhr.open('GET', url, true);
            xhr.send(null);
        });
    }

    /* ========================== */
    /* service worker push相关部分 */
    /* ========================== */
    /**
     * 注意这里修改了前一篇文章中service worker注册部分的代码
     * 将service worker的注册封装为一个方法，方便使用
     * @param {string} file service worker文件路径
     * @return {Promise}
     */
    function registerServiceWorker(file) {
        return navigator.serviceWorker.register(file);
    }

    /**
     * 用户订阅相关的push信息
     * 会生成对应的pushSubscription数据，用于标识用户与安全验证
     * @param {ServiceWorker Registration} registration
     * @param {string} publicKey 公钥
     * @return {Promise}
     */
    function subscribeUserToPush(registration, publicKey) {
        var subscribeOptions = {
            userVisibleOnly: true,
            applicationServerKey: publicKey
        }; 
        return registration.pushManager.subscribe(subscribeOptions).then(function (pushSubscription) {
            console.log('Received PushSubscription: ', JSON.stringify(pushSubscription));
            return pushSubscription;
        });
    }

    /**
     * 将浏览器生成的subscription信息提交到服务端
     * 服务端保存该信息用于向特定的客户端用户推送
     * @param {string} body 请求体
     * @param {string} url 提交的api路径，默认为/subscription
     * @return {Promise}
     */
    function sendSubscriptionToServer(body, url) {
        url = url || '/subscription';
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.timeout = 60000;
            xhr.onreadystatechange = function () {
                var response = {};
                if (xhr.readyState === 4 && xhr.status === 200) {
                    try {
                        response = JSON.parse(xhr.responseText);
                    }
                    catch (e) {
                        response = xhr.responseText;
                    }
                    resolve(response);
                }
                else if (xhr.readyState === 4) {
                    resolve();
                }
            };
            xhr.onabort = reject;
            xhr.onerror = reject;
            xhr.ontimeout = reject;
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(body);
        });
    }

    if ('serviceWorker' in navigator && 'PushManager' in window) {
        var publicKey = 'BAbjTnkbSSYfFfNTe6pChGDHf6cdhdjnDzxGfnH6hCFNOeMiDALkZDBlibFNh2fSDlhjV5xNI6AQXnZqAA3JchI';
        // 注册service worker
        registerServiceWorker('./sw.js').then(function (registration) {
            console.log('Service Worker 注册成功');
            // 开启该客户端的消息推送订阅功能
            return subscribeUserToPush(registration, publicKey);
        }).then(function (subscription) {
            var body = {subscription: subscription};
            // 为了方便之后的推送，为每个客户端简单生成一个标识
            body.uniqueid = localStorage.getItem('uniqueid') ? localStorage.getItem('uniqueid') : new Date().getTime();
            localStorage.setItem('uniqueid', body.uniqueid)
            console.log('body.uniqueid', body.uniqueid)
            // 将生成的客户端订阅信息存储在自己的服务器上
            return sendSubscriptionToServer(JSON.stringify(body));
        }).then(function (res) {
            console.log(res);
        }).catch(function (err) {
            console.log(err);
        });
    }
    /* ========================== */
    document.getElementById('push').onclick = function () {
        var xhr = new XMLHttpRequest();
        xhr.timeout = 60000;
        xhr.onreadystatechange = function () {
            var response = {};
            console.log('response', response)
            if (xhr.readyState === 4 && xhr.status === 200) {
                try {
                    response = JSON.parse(xhr.responseText);
                }
                catch (e) {
                    response = xhr.responseText;
                }
                console.log('response', response)
            }
            else if (xhr.readyState === 4) {
                console.log('xhr', xhr)
            }
        };
        xhr.open('POST', '/push', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        let {current, location} = currentWeather
        const data = JSON.stringify({
            payload: {
                text: `当前${location.name}天气`,
                body: `体感温度: ${current.feelslike_c}°C`,
                icon: 'https:' + current.condition.icon
            },
            uniqueid: localStorage.getItem('uniqueid') // 替换需要推送的uniqueid（数据库中的）
        })
        xhr.send(data);
    }

})();