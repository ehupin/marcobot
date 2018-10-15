import { inspect } from 'util'

import axios from 'axios'
// import {signedRequest} from "../signedRequest.js"

// import {Market} from '../markets.js'

import { connectDb, getWithdrawFees } from '../database.js'
import { keys } from '../../keys/bitstamp.js'

const fs = require('fs')
const crypto = require('crypto')
const request = require('request-promise')
const cheerio = require('cheerio')
const deepmerge = require('deepmerge')
const querystring = require('querystring')
const https = require('https')
const _ = require('underscore')

const marketPrices = {}
const bitstamp = {
    name: 'bitstamp',
    tradingFees: 0.0025,
    async getCurrencies() {
        const currencies = {}
        const currencieNames = ['bch', 'btc', 'eth', 'eur', 'ltc', 'usd', 'xrp']
        for (const currencyName of currencieNames) {
            currencies[currencyName] = {
                withdrawEnabled: true,
                withdrawMin: 0,
                withdrawFee: 0,
                depositEnabled: true,
            }
        }
        return currencies
    },
    async getMarkets() {
        const markets = {}
        const result = await axios.get('https://www.bitstamp.net/api/v2/trading-pairs-info/')
        const rawMarkets = result.data
        for (const rawMarket of rawMarkets) {
            const label = rawMarket.name.toLowerCase()
            let market = {
                baseCurrency: label.split('/')[0],
                quoteCurrency: label.split('/')[1],
            }
            const priceData = await axios.get(
                `https://www.bitstamp.net/api/v2/ticker/${rawMarket.url_symbol}`,
            )

            market = Object.assign(market, {
                askPrice: priceData.data.ask,
                bidPrice: priceData.data.bid,
                baseVolume: priceData.data.volume,
                quoteVolume: 0,
            })
            markets[label] = market
        }

        return markets
    },
    async getWalletAmount(currencyName) {
        const result = await this._signedRequest('post', '/api/v2/balance/')
        return Number(result[`${currencyName}_available`])
    },
    async placeOrder(marketName, amount, type) {
        const marketUrlSymbol = marketName.replace('/', '')
        await this._signedRequest('post', `/api/v2/${type}/market/${marketUrlSymbol}/`, { amount })
    },
    async getDepositAddress(currencyName) {
        const currenciesWithdrawalUrls = {
            btc: '/api/bitcoin_deposit_address/',
            ltc: '/api/v2/ltc_address/',
            eth: '/api/v2/eth_address/',
            xrp: '/api/v2/xrp_address/',
            bch: '/api/v2/bch_address/',
        }
        const result = await this._signedRequest('post', currenciesWithdrawalUrls[currencyName])
        const address = result.address ? result.address : result
        return { address }
    },
    async makeWithdrawal(currencyName, amount, address) {
        const currenciesWithdrawalUrls = {
            btc: '/api/bitcoin_withdrawal/',
            ltc: '/api/v2/ltc_withdrawal/',
            eth: '/api/v2/eth_withdrawal/',
            xrp: '/api/v2/xrp_withdrawal/',
            bch: '/api/v2/bch_withdrawal/',
        }
        await this._signedRequest('post', currenciesWithdrawalUrls[currencyName], {
            amount,
            address,
            instant: 0,
        })
    },
    async getOrderBook(marketName, type) {
        marketName = marketName.replace('/', '').toLowerCase()

        let result = null
        if (marketName == 'btcusd') {
            result = await axios.get('https://www.bitstamp.net/api/order_book/')
        } else {
            result = await axios.get(`https://www.bitstamp.net/api/v2/order_book/${marketName}/`)
        }

        const rawOrders = result.data[`${type}s`]
        const orders = []
        for (const order of rawOrders) {
            orders.push({
                price: Number(order[0]),
                amount: Number(order[1]),
            })
        }
        return orders
    },
    async applyWithdrawFees(currencyName, srcTradeOutput) {
        if (srcTradeOutput < currencyFees.withdrawMin) {
            throw 'withdraw disabled'
        }
        const db = connectDb()
        const currencyFees = await getWithdrawFees(db, this.name, currencyName)
        if (!currencyFees.withdrawEnabled) {
            throw 'withdraw disabled'
        }
        const withdrawOutput = srcTradeOutput - currencyFees.withdrawFee
        return withdrawOutput
    },
    async applyTradingFees(srcTradeOutput) {
        return srcTradeOutput * (1 - this.tradingFees)
    },
    async _signedRequest(method, path, args = {}) {
        // set nonce and bulid signature
        const nonce = `${Date.now()}0000`
        const message = nonce + keys.CLIENT_ID + keys.API_KEY
        const signer = crypto.createHmac('sha256', new Buffer(keys.API_SECRET, 'utf8'))
        const signature = signer
            .update(message)
            .digest('hex')
            .toUpperCase()

        // combine args
        args = Object.assign(
            args,
            {
                key: keys.API_KEY,
                signature,
                nonce,
            },
            args,
        )

        const data = querystring.stringify(args)

        const timeout = 5000
        const options = {
            host: 'www.bitstamp.net',
            path,
            method,
            headers: {
                'User-Agent': 'Mozilla/4.0 (compatible; Bitstamp node.js client)',
            },
        }

        if (method === 'post') {
            options.headers['Content-Length'] = data.length
            options.headers['content-type'] = 'application/x-www-form-urlencoded'
        }

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                res.setEncoding('utf8')
                let buffer = ''

                res.on('data', (data) => {
                    buffer += data
                })

                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        let message

                        try {
                            message = JSON.parse(buffer)
                        } catch (e) {
                            message = buffer
                        }
                        reject(`Bitstamp error ${res.statusCode}`, message)
                        return
                    }
                    try {
                        var json = JSON.parse(buffer)
                    } catch (err) {
                        reject(err)
                    }
                    resolve(json)
                })
            })

            req.on('error', (err) => {
                console.log(err)
            })

            req.on('socket', (socket) => {
                socket.setTimeout(timeout)
                socket.on('timeout', () => {
                    req.abort()
                })
            })
            req.end(data)
        })
    },
}

export { bitstamp }

async function test() {
    let a = null

    // a = await bitstamp.getCurrencies()
    // console.log(a)
    try {
        a = await bitstamp.getOrderBook('btc/eur', 'bid')
        console.log(a)
    } catch (e) {
        console.log(e)
    }
}
// test()
