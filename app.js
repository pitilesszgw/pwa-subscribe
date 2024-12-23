const util      = require('./util');
const http      = require('http');
const Koa       = require('koa');
const serve     = require('koa-static');
const Router    = require('koa-router');
const koaBody   = require('koa-body');
const webpush   = require('web-push');

const port = process.env.PORT || 8085;
const app = new Koa();
const router = new Router();

/**
 * 根据关键词获取图书信息
 */
router.get('/current', async (ctx, next) => {
    let query = ctx.request.query;
    let {q} = query;
    let url = `https://api.weatherapi.com/v1/current.json?key=87af5e84e4fa41e2bcb92648242012&q=${q}`;
    let res = await util.get(url);
    ctx.response.body = res;
});

/**
 * VAPID值
 */
const vapidKeys = {
    publicKey: 'BAbjTnkbSSYfFfNTe6pChGDHf6cdhdjnDzxGfnH6hCFNOeMiDALkZDBlibFNh2fSDlhjV5xNI6AQXnZqAA3JchI',
    privateKey: 'z5R4Sbp5dYjHJGGhpdjhvMiu-AUFv8T61ZvHlpELTvU'
};

// 设置web-push的VAPID值
webpush.setVapidDetails(
    'mailto:zgw0223@sina.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

/**
 * 提交subscription信息，并保存
 */
router.post('/subscription', koaBody(), async ctx => {
    let body = ctx.request.body;
    console.log('body', body)
    await util.saveRecord(body);
    ctx.response.body = {
        status: 0
    };
});

const options = {
    // proxy: 'http://localhost:7890' // 使用FCM（Chrome）需要配置代理
}
/**
 * 向push service推送信息
 * @param {*} subscription 
 * @param {*} data
 */
function pushMessage(subscription, data = {}) {
    console.log('subscription999', subscription)
    webpush.sendNotification(subscription, data, options).then(data => {
        console.log('push service的相应数据:', JSON.stringify(data));
        return;
    }).catch(err => {
        // 判断状态码，440和410表示失效
        if (err.statusCode === 410 || err.statusCode === 404) {
            return util.remove(subscription);
        }
        else {
            console.log(subscription);
            console.log(err);
        }
    })
}

/**
 * 消息推送API，可以在管理后台进行调用
 * 本例子中，可以直接post一个请求来查看效果
 */
router.post('/push', koaBody(), async ctx => {
    let {uniqueid, payload} = ctx.request.body;
    console.log('uniqueid', uniqueid)
    console.log('await util.find({uniqueid})', await util.find({uniqueid}))
    let list = uniqueid ? await util.find({uniqueid}) : await util.findAll();
    let status = list.length > 0 ? 0 : -1;
    console.log('list', list)
    for (let i = 0; i < list.length; i++) {
        let subscription = list[i].subscription;
        console.log('subscription', subscription)
        pushMessage(subscription, JSON.stringify(payload));
    }

    ctx.response.body = {
        status
    };
});
/* ===================== */

app.use(router.routes());
app.use(serve(__dirname + '/public'));
app.listen(port, () => {
    console.log(`listen on port: ${port}`);
});