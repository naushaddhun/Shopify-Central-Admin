require('isomorphic-fetch');
require('dotenv').config();
const https = require("https");
const request = require("request");
const fs = require('fs');
var url = require('url');
var bodyParser = require('body-parser');
var mysql = require('mysql');
const express = require('express');
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const path = require('path');
const logger = require('morgan');

const webpack = require('webpack');
const webpackMiddleware = require('webpack-dev-middleware');
const webpackHotMiddleware = require('webpack-hot-middleware');
const config = require('../config/webpack.config.js');
const ShopifyNodeAPI = require('shopify-node-api');
const ShopifyAPIClient = require('shopify-api-node');
const ShopifyExpress = require('@shopify/shopify-express');
const {MemoryStrategy} = require('@shopify/shopify-express/strategies');

var con = mysql.createConnection({
host: "localhost",
user: "root",
password: "root",
database: "shopify"
});

con.connect(function(err) {
if (err) throw err;
console.log("Connected!");
});

const {
  SHOPIFY_APP_KEY,
  SHOPIFY_APP_HOST,
  SHOPIFY_APP_SECRET,
  NODE_ENV,
} = process.env;

const shopifyConfig = {
  host: SHOPIFY_APP_HOST,
  apiKey: SHOPIFY_APP_KEY,
  secret: SHOPIFY_APP_SECRET,
  scope: ['write_orders,write_draft_orders,write_products,read_orders,read_draft_orders,read_product_listings,read_customers,write_customers'],
  shopStore: new MemoryStrategy(),
  afterAuth(request, response) {
    const { session: { accessToken, shop } } = request;

    registerWebhook(shop, accessToken, {
      topic: 'orders/create',
      address: `${SHOPIFY_APP_HOST}/order-create`,
      format: 'json'
    });

    return response.redirect('/');
  },
};

const registerWebhook = function(shopDomain, accessToken, webhook) {
    const shopName = shopDomain.replace('.myshopify.com', '');
  const shopify = new ShopifyAPIClient({ shopName: shopDomain, accessToken: accessToken });
  shopify.webhook.create(webhook).then(
    response => console.log(`webhook '${webhook.topic}' created`),
    err => console.log(`Error creating webhook '${webhook.topic}'. ${JSON.stringify(err.response.body)}`)
  );
}

const app = express();
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});
const isDevelopment = NODE_ENV !== 'production';

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(logger('dev'));
app.use(
  session({
    store: isDevelopment ? undefined : new RedisStore(),
    secret: SHOPIFY_APP_SECRET,
    resave: true,
    saveUninitialized: false,
  })
);

// Run webpack hot reloading in dev
if (isDevelopment) {
  const compiler = webpack(config);
  const middleware = webpackMiddleware(compiler, {
    hot: true,
    inline: true,
    publicPath: config.output.publicPath,
    contentBase: 'src',
    stats: {
      colors: true,
      hash: false,
      timings: true,
      chunks: false,
      chunkModules: false,
      modules: false,
    },
  });

  app.use(middleware);
  app.use(webpackHotMiddleware(compiler));
} else {
  const staticPath = path.resolve(__dirname, '../assets');
  app.use('/assets', express.static(staticPath));
}

// Install
app.get('/install', (req, res) => res.render('install'));

// Create shopify middlewares and router
const shopify = ShopifyExpress(shopifyConfig);

// Mount Shopify Routes
const {routes, middleware} = shopify;
const {withShop, withWebhook} = middleware;

app.use('/shopify', routes);

// Client
app.get('/', withShop({authBaseUrl: '/shopify'}), function(request, response) {
  const { session: { shop, accessToken } } = request;
  response.render('app', {
    title: 'Shopify Node App',
    apiKey: shopifyConfig.apiKey,
    shop: shop,
  });
});
//====================Shop Data========================
app.get('/shops', function (req, res){
  //res.render('embedproducts');
  var shop;
  var shoparray=[];
  var idquery="SELECT * FROM appdetails";
  con.query(idquery, function (err,result)
   {
     //console.log(result)
     shop = result;
    // console.log(shop);

     for (var i=0; i<result.length; i++){
           shoparray.push(shop[i]);
     }
     //console.log(JSON.stringify(shoparray));
            if (err) throw err;

    });


    setTimeout(function () {
    res.render('shops', {
      shops: shoparray
    });
  },1000);
});

//=================Home page==========
app.get('/home', function(req, res){
  var shopname = url.parse(req.url, true).query;
  var shop = JSON.stringify(shopname.shop);
  var shop1 = shopname.shop;
        res.render('home', {
          shop: shop1
        });
        if (err) throw err;
        return null;
});
//=================order details==========
app.get('/orders', function(req, res){
  var access_token;
  var orders;
  var shopname = url.parse(req.url, true).query;
  var Shopify;
  //console.log(shopname.shop);
  var shop = JSON.stringify(shopname.shop);
  var shop1 = shopname.shop;
  var getaccess = "SELECT access_token FROM appdetails WHERE "+'shop='+ shop;
//  console.log(getaccess);
  con.query(getaccess, function(err, data){
    //console.log(data);
    if (err) throw err;
    var accessToken = data;
      access_token = accessToken[0]['access_token'];
      //console.log(access_token);
      Shopify = new ShopifyNodeAPI({
        shop: shopname.shop,
        shopify_api_key: SHOPIFY_APP_KEY,
        shopify_shared_secret: SHOPIFY_APP_SECRET,
        access_token: access_token,
      });

      Shopify.get('/admin/orders.json?status=any', function(err, data, headers){
        //console.log('inside');
        //console.log(JSON.stringify(data));
        orders = JSON.stringify(data.orders);
        res.render('orders', {
          orders: orders,
          shop: shop1
        });
        if (err) throw err;
        return null;
      })
  });

});

//=============================Display Products===========================
app.get('/products', function(req, res){
  var access_token;
  var products;
  var shopname = url.parse(req.url, true).query;
  var Shopify;
  //console.log(shopname.shop);
  var shop = JSON.stringify(shopname.shop);
  var shop1 = shopname.shop;
  var getaccess = "SELECT access_token FROM appdetails WHERE "+'shop='+ shop;
  //console.log(getaccess);
  con.query(getaccess, function(err, data){
    //console.log(data);
    if (err) throw err;
    var accessToken = data;
      access_token = accessToken[0]['access_token'];
      //console.log(access_token);
      Shopify = new ShopifyNodeAPI({
        shop: shopname.shop,
        shopify_api_key: SHOPIFY_APP_KEY,
        shopify_shared_secret: SHOPIFY_APP_SECRET,
        access_token: access_token,
      });
      Shopify.get('/admin/products.json', function(err, data, headers){
        products = JSON.stringify(data.products);
        //console.log(products);
        res.render('products', {
          products: products,
          shop: shop1
        });
        if (err) throw err;
        return null;
      })
  });

});
//=============================Display Product Variants===========================
app.get('/prod_var', function(req, res){
  var access_token;
  var product;
  var var_product;
  var shopname = url.parse(req.url, true).query;
  var Shopify;
  var prod_id = shopname.id;
  //console.log(shopname.shop);
  var shop = JSON.stringify(shopname.shop);
  var shop1 = shopname.shop;
  var getaccess = "SELECT access_token FROM appdetails WHERE "+'shop='+ shop;
  //console.log(getaccess);
  con.query(getaccess, function(err, data){
    //console.log(data);
    if (err) throw err;
    var accessToken = data;
      access_token = accessToken[0]['access_token'];
      //console.log(access_token);
      Shopify = new ShopifyNodeAPI({
        shop: shopname.shop,
        shopify_api_key: SHOPIFY_APP_KEY,
        shopify_shared_secret: SHOPIFY_APP_SECRET,
        access_token: access_token,
      });
      Shopify.get('/admin/products/' + prod_id + '.json', function(err, data, headers){
        var_product = JSON.stringify(data.product.variants);
        product = JSON.stringify(data.product.images);
        //console.log(product);
        res.render('variants', {
          variant_img: product,
          product_variant: var_product,
          shop: shop1
        });
        if (err) throw err;
        return null;
      })
  });

});
//=============================Display Products===========================
app.get('/customers', function(req, res){
  var access_token;
  var customers;
  var shopname = url.parse(req.url, true).query;
  var Shopify;
  //console.log(shopname.shop);
  var shop = JSON.stringify(shopname.shop);
  var shop1 = shopname.shop;
  var getaccess = "SELECT access_token FROM appdetails WHERE "+'shop='+ shop;
  //console.log(getaccess);
  con.query(getaccess, function(err, data){
    //console.log(data);
    if (err) throw err;
    var accessToken = data;
      access_token = accessToken[0]['access_token'];
      //console.log(access_token);
      Shopify = new ShopifyNodeAPI({
        shop: shopname.shop,
        shopify_api_key: SHOPIFY_APP_KEY,
        shopify_shared_secret: SHOPIFY_APP_SECRET,
        access_token: access_token,
      });
      Shopify.get('/admin/customers.json', function(err, data, headers){
        customers = JSON.stringify(data.customers);
        //console.log(products);
        res.render('customers', {
          customers: customers,
          shop: shop1
        });
        if (err) throw err;
        return null;
      })
  });

});
//=====================Display Order Details=========================================
// app.get('/orderprods', function(req, res){
//   var prods;
//   var id;
//   var idarr = [];
//   var img = [];
//   var imgarr = [];
//   var order;
//   var Query = url.parse(req.url, true).query;
//   var order_id = Query.id;
//   var shop = JSON.stringify(Query.shop);
//   var shop1 = Query.shop;
//   var Shopify;
//   var getaccess = "SELECT access_token FROM appdetails WHERE "+'shop='+ shop;
//   //console.log(getaccess);
//   con.query(getaccess, function(err, data){
//     //console.log(data);
//     if (err) throw err;
//     var accessToken = data;
//       access_token = accessToken[0]['access_token'];
//       //console.log(access_token);
//       Shopify = new ShopifyNodeAPI({
//         shop: shop1,
//         shopify_api_key: SHOPIFY_APP_KEY,
//         shopify_shared_secret: SHOPIFY_APP_SECRET,
//         access_token: access_token,
//       });
//       Shopify.get('/admin/orders/' + order_id + '.json?', function(err, data, headers){
//         //console.log('inside');
//         //console.log(JSON.stringify(data));
//         order = data.order.line_items;
//         //console.log(order);
//         id = order;
//         //setTimeout(function(){
//         for(var i=0; i<order.length; i++){
//           idarr.push(id[i]['product_id']);
//         }
//       //}, 100);
//
//
//         if (err) throw err;
//         return null;
//       })
//       setTimeout(function(){
//         console.log(idarr);
//       for(var i=0; i<idarr.length; i++){
//         console.log(idarr[i]);
//         Shopify.get('/admin/products/' + idarr[i] + '.json', function(err, data, headers){
//           img.push(data.product);
//           console.log('img data:', img);
//         })
//
//       }
//       setTimeout(function(){
//       res.render('Vieworder', {
//         order: order,
//         shop: shop1,
//         shopdata: img
//         //imgarr: imgarr
//       });
//     }, 6000);
//   }, 5000);
//
//   });
//
// });
//=================Close order==========
app.use( bodyParser.json() );
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
 extended: true
}));
// app.post('/close_ord', withWebhook((error, request) =>{
//   if (error) {
//     console.error(error);
//     return;
//   }
//   var access_token;
//   var orders;
//   var shopname = url.parse(req.url, true).query;
//   var Shopify;
//   //console.log(shopname.shop);
//   var shop = JSON.stringify(shopname.shop);
//   var shop1 = shopname.shop;
//   var order_id = shopname.id;
//   var getaccess = "SELECT access_token FROM appdetails WHERE "+'shop='+ shop;
// //  console.log(getaccess);
//   con.query(getaccess, function(err, data){
//     //console.log(data);
//     if (err) throw err;
//     var accessToken = data;
//       access_token = accessToken[0]['access_token'];
//       //console.log(access_token);
//       Shopify = new ShopifyNodeAPI({
//         shop: shopname.shop,
//         shopify_api_key: SHOPIFY_APP_KEY,
//         shopify_shared_secret: SHOPIFY_APP_SECRET,
//         access_token: access_token,
//       });
//
//       Shopify.post('/admin/orders/'+ order_id + '/close.json', function(err, data, headers){
//         //console.log('inside');
//         //console.log(JSON.stringify(data));
//         orders = JSON.stringify(data.orders);
//         res.render('orders', {
//           orders: orders,
//           shop: shop1
//         });
//         if (err) throw err;
//         return null;
//       })
//   });
//
// }));
//===============================================================

app.post('/order-create', withWebhook((error, request) => {
  if (error) {
    console.error(error);
    return;
  }

  console.log('We got a webhook!');
  console.log('Details: ', request.webhook);
  console.log('Body:', request.body);
}));

// Error Handlers
app.use(function(req, res, next) {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use(function(error, request, response, next) {
  response.locals.message = error.message;
  response.locals.error = request.app.get('env') === 'development' ? error : {};

  response.status(error.status || 500);
  response.render('error');
});

module.exports = app;
