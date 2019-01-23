/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

var expect = require('chai').expect;
var MongoClient = require('mongodb');
const axios = require('axios')

const IEXURL = 'https://api.iextrading.com/1.0/tops/last'

async function getQuote(symbols) {
  symbols = symbols.constructor === Array ? symbols : [symbols]
  symbols = symbols.join(',')
  let res = await axios.get(IEXURL, {params: {symbols}})
  return res.status === 200 ? res.data : null
}

const CONNECTION_STRING = process.env.DB; 
let db
let dbOk = false

MongoClient.connect(CONNECTION_STRING, {useNewUrlParser: true}, async function(err, client) {
  if(err) return
  db = client.db(process.env.DBNAME)
  
  try {
    let result = await db.collection('stocks').findOne({});
    dbOk = true
    console.log('db connection looks good')
  } catch(err) {
    console.log(err.message)
  }
});

module.exports = function (app) {

  app.route('/api/stock-prices')
    .get(async function (req, res){
      var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      ip = ip.split(',')[0]
      let {stock, like} = req.query
      stock = stock.constructor === Array ? stock : [stock]
    
      if(like) {
        stock.forEach(symbol => {
          let options = { upsert: true }
          db.collection('stocks').findOneAndUpdate(
            {name: symbol}, 
            {$set: {name: symbol}, $addToSet: {likes: ip}}, 
            options
          )
        })
      }
    
      let stockData = await Promise.all(stock.map(async (symbol) => {
        let quotesData = await getQuote(symbol)

        let quoteData = quotesData.length ? quotesData[0] : null
        let price = quoteData ? quoteData.price.toString() : 'unknown'
        let result = await db.collection('stocks').findOne({name: symbol})
        //console.log(result)
        let likes = result ? result.likes.length : 0;
        
        return {stock: symbol, price, likes}
      }))

      stockData = stockData.length===1 ? stockData[0] : stockData
    
      if(stockData.constructor === Array) {
        stockData[0].rel_likes = stockData[0].likes - stockData[1].likes
        stockData[1].rel_likes = -stockData[0].rel_likes
      }
      res.json({stockData});
    });
    
};
