import axios from 'axios'
import {Market} from '../markets.js'

const fs = require("fs")
import { inspect } from 'util' 

const bittrex = {
    label: 'bittrex',
    tradingFees: 0.0025,
    withdrawalFees: {
        btc:0.0005,
        eth:0.006,
        xrp:1,
        "bcc/bch":0.001,
        xlm:0.01,
        ltc:0.01,
        ada:0.2,
        trx:0.003,
        neo:0.025,
        etc:0.01,
        xem:4,
        omg:0.35,
        lsk:0.1,
        zrx:1,
    },
    async fetchMarkets(){
        let markets = []
        const apiResult = await axios.get("https://bittrex.com/api/v1.1/public/getmarkets")
        for (let remotePair of apiResult.data.result){
            const pairLabel = remotePair.MarketName
            let newMarket = Market('bittrex', pairLabel)
            newMarket.baseCurrency = pairLabel.split('-')[0].toLowerCase()
            newMarket.quoteCurrency = pairLabel.split('-')[1].toLowerCase()
            markets.push(newMarket)
        }
        return markets
    },
    async fetchMarketPrice(market){
        await axios.get(`https://bittrex.com/Api/v2.0/pub/market/GetLatestTick?marketName=${market.urlLabel}&tickInterval=fiveMin`)
                .then(result => {
                    if (result.data.result !== null){
                        market.price = Number(result.data.result[0].C)
                    }
                })
        return market
    }
}

export {bittrex}


