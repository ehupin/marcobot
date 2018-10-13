const fs = require("fs")
import { inspect } from 'util' 
const crypto = require('crypto');
const qs = require('qs');
import axios from 'axios'
var request = require('request-promise');
var cheerio = require('cheerio');
const deepmerge = require('deepmerge');
import {signedRequest} from '../signedRequest.js'
import {connectDb, getWithdrawFees} from '../database.js'

import {keys} from '../../keys/binance.js'


let marketPrices = {}
const binance = {
    name: 'binance',
    tradingFees: 0.001,
    async getCurrencies(){
        
        const data = {
          recvWindow: 20000,
          timestamp: Date.now(),
        };
        
        const result = await this._signedRequest(`get`, '/wapi/v3/assetDetail.html', data);
        const rawCurrencies = result.assetDetail
        
        let currencies = {}
        for (const currencyName in rawCurrencies){
            currencies[currencyName.toLowerCase()] = {
                withdrawEnabled: rawCurrencies[currencyName].withdrawStatus,
                withdrawMin: rawCurrencies[currencyName].minWithdrawAmount,
                withdrawFee: rawCurrencies[currencyName].withdrawFee,
                depositEnabled: rawCurrencies[currencyName].depositStatus,
            }   
        }
        return currencies
    },
    async getMarkets(){
        const apiResult = await axios.get("https://api.binance.com/api/v1/exchangeInfo")
        
        let markets = {}
        for (let remotePair of apiResult.data.symbols){
            markets[remotePair.symbol] = {
                baseCurrency: remotePair.baseAsset.toLowerCase(),
                quoteCurrency: remotePair.quoteAsset.toLowerCase(),
                minTradeAmount: remotePair.filters[1].minQty,
                maxTradeAmount: remotePair.filters[1].maxQty,
                minTradeStep: remotePair.filters[1].stepSize,
            }
        }
        const marketsUpdates = await this._getMarketsUpdates()
        markets = deepmerge(markets, marketsUpdates);
        
        let labeledMarkets = {}
        for (const marketSymbol in markets){
            const market = markets[marketSymbol]
            const label = `${market.baseCurrency}/${market.quoteCurrency}`
            labeledMarkets[label] = market
        }
        return labeledMarkets
    },
    async _getMarketsUpdates(){
        const result = await axios.get('https://api.binance.com/api/v1/ticker/24hr');
        let markets = {}
        for (const market of result.data){
            markets[market.symbol] = {
                bidPrice: Number(market.bidPrice),
                askPrice: Number(market.askPrice),
                baseVolume: Number(market.volume),
                quoteVolume: Number(market.quoteVolume),
            }
        }
        return markets
    },
    async makeTrade(marketName, amount, estimatedOutputAmount, type){
        
        const tradingFees = (await this.getMarkets())[marketName]
        
        const decimal = tradingFees.minTradeStep.split
        
        
        
        const decaMult = Math.pow(1,1)
        const amountInTmp = Math.trunc(
                                    estimatedOutputAmount * decaMult
                                    ) / decaMult
        
        const data = {
            symbol: marketName.replace('/','').toUpperCase(),
            side: type.toUpperCase(),
            type: 'MARKET',
            quantity: amount,
            newOrderRespType: 'FULL',
            timestamp: Date.now(),
            recvWindow: 10000,
        }
        
        
        return await this._signedRequest('post', 
                                    `/api/v3/order`, 
                                    data)
    },
    async getWalletAmount(currencyName){
        const result = await this._signedRequest('get', 
                                                '/api/v3/account', 
                                                {timestamp: Date.now()})
        for (const asset of result.balances){
            if (asset.asset.toLowerCase() == currencyName){
                return Number(asset.free)
            }
        }
    },
    async getDepositAddress(currencyName){
        let result = await this._signedRequest('get', 
                                                '/wapi/v3/depositAddress.html',
                                                {
                                                    asset: currencyName,
                                                    timestamp: Date.now()
                                                }
                                                )
        return {address: result.address, tag: result.addressTag, url: result.url}
    },
    async makeWithdrawal(currencyName, amount, address, addressTag){
        let data = {
           asset: currencyName,
           address,
           amount,
           recvWindow: 10000,
           timestamp: Date.now()
        }
        
        return await this._signedRequest('post', '/wapi/v3/withdraw.html', data)
    },
    async getOrderBook(marketName, type){
        marketName = marketName.replace('/','').toUpperCase()
        const result = await axios.get(`https://api.binance.com/api/v1/depth?symbol=${marketName}`)
        const rawOrders = result.data[type + 's']
        let orders = []
        for (const order of rawOrders){
            orders.push({
                price: Number(order[0]),
                amount: Number(order[1])
            })
        }
        return orders
    },
    async applyWithdrawFees(currencyName, srcTradeOutput){
        const db = connectDb()
        const currencyFees = await getWithdrawFees(db, this.name, currencyName)
        if (!currencyFees){
            throw 'cannot get fees from database'
        }
        if (srcTradeOutput <currencyFees[0].withdrawMin){
            throw `withdraw too low ${srcTradeOutput} < ${currencyFees[0].withdrawMin}`
        }
        if (!currencyFees[0].withdrawEnabled){
            throw "withdraw disabled"
        }
        const withdrawOutput = srcTradeOutput - currencyFees[0].withdrawFee
        return withdrawOutput
    },
    async applyTradingFees(srcTradeOutput){
        return srcTradeOutput * ( 1 - this.tradingFees )
    },
    async _signedRequest(method, path, args={}){
      const dataQueryString = qs.stringify(args);
      const signature = crypto.createHmac('sha256', keys.API_SECRET).update(dataQueryString).digest('hex');
      const requestConfig = {
        method,
        url: 'https://api.binance.com' + path + '?' + dataQueryString + '&signature=' + signature,
        headers: {
            'X-MBX-APIKEY': keys.API_KEY,
        },
      };
    //   console.log(requestConfig)
    //   return
      
      try{
        const response = await axios(requestConfig);
        return response.data
      } catch(e){
          console.log(e)
          throw(e)
      }
    }
}

export {binance}

async function test(){
    
    // const amount = await binance.getWalletAmount('xrp')
    // console.log(amount)
    
    
    // const amount = await binance.makeWithdrawal('btc',
    //                                             0.01,
    //                                             '37HupeVwMQjSCVA9BdEkkX56hzyBwqBBD5')
    
    // let amount = await binance.makeTrade('gto/btc', 1, 'buy')
    // console.log(amount)
    
    // amount = await binance.getOrderBook('wings/btc','bid')
    // console.log(amount)
    // BTC
    // Bitcoin
    // 0.04869875

    
    
    
    // const currencies = await binance.getCurrencies()
    // let addresses = {}
    // for (const currencyName of Object.keys(currencies)){
    //     let a = await binance.getDepositAdress(currencyName)
    //     // console.log(a)        
    //     addresses[currencyName] = a
    // }
    
    // fs.writeFile('binance_addresses.json', JSON.stringify(addresses,null,4))
    
    
    // a = await binance.getMarkets()
    // console.log(a)    
}
// test()


 
/*
TRADE 01
========
{ symbol: 'XRPBTC',
  side: 'BUY',
  type: 'MARKET',
  quantity: 10,
  newOrderRespType: 'FULL',
  timestamp: 1539284533376,
  recvWindow: 10000 }
{ symbol: 'XRPBTC',
  orderId: 83715413,
  clientOrderId: 'Z6fk6KQ54cYHyE10OOdDho',
  transactTime: 1539284536134,
  price: '0.00000000',
  origQty: '10.00000000',
  executedQty: '10.00000000',
  cummulativeQuoteQty: '0.00065110',
  status: 'FILLED',
  timeInForce: 'GTC',
  type: 'MARKET',
  side: 'BUY',
  fills:
   [ { price: '0.00006511',
       qty: '10.00000000',
       commission: '0.01000000',
       commissionAsset: 'XRP',
       tradeId: 29455034 } ] }

575.99000000


TRADE 02
========

{ symbol: 'XRPBTC',
  side: 'BUY',
  type: 'MARKET',
  quantity: 10,
  newOrderRespType: 'FULL',
  timestamp: 1539284846344,
  recvWindow: 10000 }
{ symbol: 'XRPBTC',
  orderId: 83716005,
  clientOrderId: 'hxJONVpJyAvV4yXna83h17',
  transactTime: 1539284849295,
  price: '0.00000000',
  origQty: '10.00000000',
  executedQty: '10.00000000',
  cummulativeQuoteQty: '0.00065050',
  status: 'FILLED',
  timeInForce: 'GTC',
  type: 'MARKET',
  side: 'BUY',
  fills:
   [ { price: '0.00006505',
       qty: '10.00000000',
       commission: '0.01000000',
       commissionAsset: 'XRP',
       tradeId: 29455162 } ] }
       
575.99 -> 585.98
*/