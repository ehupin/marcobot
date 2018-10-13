const fs = require("fs")
import { inspect } from 'util' 
const crypto = require('crypto');
const qs = require('qs');
import axios from 'axios'
var request = require('request-promise');
var cheerio = require('cheerio');

// import {Market} from '../markets.js'
import {connectDb, getWithdrawFees} from '../database.js'



import {keys} from '../../keys/bittrex.js'


let marketPrices = {}
const bittrex = {
    name: 'bittrex',
    tradingFees: 0.0025,
    
    _cleanMarketName(marketName){
        const [baseCurrency, quoteCurrency] = marketName.split('/') 
        return `${quoteCurrency}-${baseCurrency}`.toUpperCase()
    },
    async _signedRequest(method, path, args={}){
        
        const nonce = Date.now()
        args = Object.assign(args,{
            nonce,
            apikey: keys.API_KEY
        })
        
        const dataQueryString = qs.stringify(args);
        const url = `https://bittrex.com${path}?${dataQueryString}`; 
        const signature = crypto.createHmac('sha512', keys.API_SECRET).update(url).digest('hex');
        
        const requestConfig = {
                method,
                url,
                headers: {
                    'apisign': signature,
                },
              };

      try{
        const response = await axios(requestConfig);
        
        if (!response.data.success){
            throw 'request has failed: ' + response.data.message
        }
        
        return response.data
      } catch(e){
          console.log(e)
          throw(e)
      }
    },
    
    async getCurrencies(){
        
        const result = await axios.get("https://bittrex.com/api/v1.1/public/getcurrencies")
        let rawCurrencies =  result.data.result
        let currencies = {}
        for (let currency of rawCurrencies){
            currencies[currency.Currency.toLowerCase()] = {
                withdrawEnabled: currency.IsActive,
                withdrawMin: currency.TxFee*3,
                withdrawFee: currency.TxFee,
                depositEnabled: currency.IsActive,
            }   
        }
        return currencies
    },
    async getMarkets(){
        const apiResult = await axios.get("https://bittrex.com/api/v2.0/pub/markets/GetMarketSummaries")
        
        let markets = {}
        for (let rawMarket of apiResult.data.result){
            const market= {
                baseCurrency: rawMarket.Market.MarketCurrency.toLowerCase(),
                quoteCurrency: rawMarket.Market.BaseCurrency.toLowerCase(),
                bidPrice: rawMarket.Summary.Bid,
                askPrice: rawMarket.Summary.Ask,
                baseVolume: rawMarket.Summary.Volume,
                quoteVolume: rawMarket.Summary.BaseVolume,
            }
            const label = `${market.baseCurrency}/${market.quoteCurrency}`
            markets[label] = market
        }
        return markets
    },
    async getWalletAmount(currencyName){
        const result = await this._signedRequest('get', 
                                                '/api/v1.1/account/getbalance', 
                                                {currency: currencyName}
                                                )
        
        return result.result.Available
    },
    async getDepositAddress(currencyName){
        const result = await this._signedRequest('get', 
                                                '/api/v1.1/account/getdepositaddress', 
                                                {currency: currencyName}
                                                )
        
        return result.result.Address
    },
    async getOrderBook(marketName, type){
        marketName = this._cleanMarketName(marketName)
        type = type == 'bid' ? 'buy' : type
        type = type == 'ask' ? 'sell' : type
        const result = await this._signedRequest('get', 
                                                '/api/v1.1/public/getorderbook', 
                                                {
                                                    market: marketName,
                                                    type
                                            })
        let orders = []        
        for (const order of result.result){
            orders.push({
                price: order.Rate,
                amount: order.Quantity,
            })   
        }
        return orders
    },
    
    async applyWithdrawFees(currencyName, srcTradeOutput){
        if (srcTradeOutput <currencyFees.withdrawMin){
            throw "withdraw disabled"
        }
        const db = connectDb()
        const currencyFees = await getWithdrawFees(db, this.name, currencyName)
        if (!currencyFees.withdrawEnabled){
            throw "withdraw disabled"
        }
        const withdrawOutput = srcTradeOutput - currencyFees.withdrawFee
        return withdrawOutput
    },
    async applyTradingFees(srcTradeOutput){
        return srcTradeOutput* ( 1 - this.tradingFees )
    },
    
    // async orderIsCompleted(marketName,orderId){
    //     marketName = marketName.replace('/','').toUpperCase()
    //     const result = await this._signedRequest('get','/api/v3/order',
    //                                             {
    //                                                 symbol: marketName,
    //                                                 orderId,
    //                                                 timestamp: Date.now()
    //                                             })
    //     return result.status === 'FILLED'
    // },
    async withdrawIsCompleted(withdrawId){
        const result = await this._signedRequest('get',
                                                `/api/v1.1/account/getwithdrawalhistory`,)
        
        let found = false                                                
        for (const withdraw of result.result){
            if (withdraw.PaymentUuid === withdrawId){
                found = true
                if (withdraw.Authorized && !withdraw.PendingPayment){
                    return true
                }
            }
        }
        
        if (!found){
            throw `Withdraw ${withdrawId} not found!`
        }
        
        return false
    },
    async depositIsCompleted(amount, currencyName){
        const result = await this._signedRequest('get','/api/v1.1/account/getdeposithistory',
                                                {
                                                    // currency: currencyName.toUpperCase()
                                                })
                                                
        console.log(result)              
        return
        let found = false                                               
        for (const withdraw of result.result){
            if (withdraw.Amount == amount){
                found = true
                if (withdraw.status === 1){
                    return true
                }
            }
        }
        
        if (!found){
            throw `Deposit of ${amount} ${currencyName} not found!`
        }
        
        return false
    },
    
    // async placeOrder(marketName, amount, type){
        
    //     marketName = this._cleanMarketName(marketName)
    //     const priceResult = await axios.get(`https://bittrex.com/api/v1.1/public/getmarketsummary?market=${marketName}`)
    //     const limitPrice = type === 'buy' ? priceResult.data.result[0].Ask : priceResult.data.result[0].Bid 
        
    //     const data = {
    //         market: marketName,
    //         quantity: amount,
    //         rate: limitPrice //TODO: adjust price ?
    //     }
        
        
    //     const result = await this._signedRequest('get', 
    //                                             `/api/v1.1/market/${type}limit`, 
    //                                             data
    //                                             )
        
    //     return result
    // },
    async makeWithdrawal(currencyName, amount, address, addressTag){
        
        const data = {
            currency: currencyName,
            quantity: amount,
            address: address,
            paymentid: addressTag
        }
        
        
        const result = await this._signedRequest('get', 
                                                `/api/v1.1/account/withdraw`, 
                                                data
                                                )
                                                
        return {id: result.uuid}
    },
}





export {bittrex}


/*
TODO: check quantity of place order (0.005 satoshis)
TODO: test withdrawIsCompleted
TODO: pass arbitrage to place order
TODO: check output de placeOrder
TODO: add deposit is completed
TODO: add orderIsCompleted
*/

async function test(){
    let r = null
    r = await bittrex.depositIsCompleted(0.9898,'go')
    
    // const amount = await bittrex.getWalletAmount('usdt')
    // // let a = await bittrex.placeOrder('go/btc', 0.1, 'sell')
    // let withdrawOutput = await bittrex.makeWithdrawal('usdt', amount, '1Eu6L62XiS3he5au576mzNnXFqNWbVRdMK')
    // let i = setInterval(async()=>{
    //     let result = await bittrex.withdrawIsCompleted(withdrawOutput.id)

    //     console.log(result)
    //     if (result){
    //         clearInterval(i)
    //     }
    // }, 2000)

    
    // a = await bittrex.getOrderBook('usdt/btc', 'bid')
    // console.log(a)
    // let a = await bittrex.makeWithdrawal('btc', amount, '1Cx7NX9w5WomnPMTQJVjUYMVD9QUYp37De')
    // console.log(a)
    // const result = await bittrex.makeTrade('usdt/btc', 0.0009, 'buy')
    
    // const uuid = '0cb4c4e4-bdc7-4e13-8c13-430e587d2cc1'
    // const result = await bittrex._signedRequest('get', 
    //                                         `/api/v1.1/account/getorder`, 
    //                                         {uuid}
    //                                         )
                                            
                                                
    
    // https://bittrex.com/api/v1.1/account/getorder&uuid=0cb4c4e4-bdc7-4e13-8c13-430e587d2cc1
    // sur bittrex usd/btc, sell veut dire donner du btc pour avoir de l'usd
    // sur usdt/btc buy donne des usdt pour avoir des btc, le montant reste en btc (il faut calculer combien om=n obtient pour le prix)
    // console.log(result)
}
test()
 
 
 
 
/*

TRADE 01
========

{ success: true,
  message: '',
  result: { uuid: 'fe75c6d2-1d23-4df0-80b9-9de4622b346a' } }
  
  
*/
