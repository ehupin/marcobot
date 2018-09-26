import axios from 'axios'


const pairsToTrack = {
    bittrex: ['USD-BTC', 'BTC-LTC', 'BTC-ETH'],
    bitstamp: ['BTC/USD', 'ETH/BTC'],
    binnance: ['ETHBTC', 'LTCBTC'],
}

//TODO: rename currency to asset
function pair(exchange, pairLabel){
    return {
        exchange: exchange,
        baseCurrency: null,
        quoteCurrency: null,
        label: pairLabel,
        price: null,
        timestamp: null
    }
}



async function getBittrexPairs(pairs){
    return axios.get("https://bittrex.com/api/v1.1/public/getmarkets").then(result => {
        for (let remotePair of result.data.result){
            const pairLabel = remotePair.MarketName
            if (pairsToTrack.bittrex.includes(pairLabel)){
                let newPair = pair('bittrex', pairLabel)
                newPair.baseCurrency = pairLabel.split('-')[0].toLowerCase()
                newPair.quoteCurrency = pairLabel.split('-')[1].toLowerCase()
                pairs.push(newPair)
            }
        }  
    })
}

function getBitsampPairs(pairs){
    return axios.get("https://www.bitstamp.net/api/v2/trading-pairs-info/").then(result => {
        for (let remotePair of result.data){
            const pairLabel = remotePair.name
            if (pairsToTrack.bitstamp.includes(pairLabel)){
                let newPair = pair('bitstamp', remotePair.url_symbol)
                newPair.baseCurrency = pairLabel.split('/')[0].toLowerCase()
                newPair.quoteCurrency = pairLabel.split('/')[1].toLowerCase()
                pairs.push(newPair)
            }
        }  
    })
}


function getBinnancePairs(pairs){
    return axios.get("https://api.binance.com/api/v1/exchangeInfo").then(result => {
        for (let remotePair of result.data.symbols){
            const pairLabel = remotePair.symbol
            if (pairsToTrack.binnance.includes(pairLabel)){
                let newPair = pair('bittrex', remotePair.symbol)
                newPair.baseCurrency = remotePair.baseAsset.toLowerCase()
                newPair.quoteCurrency = remotePair.quoteAsset.toLowerCase()
                pairs.push(newPair)
            }
        }  
    })
}

export async function listPairs(){
    let pairs = []

    await getBittrexPairs(pairs)
    await getBitsampPairs(pairs)
    await getBinnancePairs(pairs)
    
    return pairs
}


export async function updatePairs(pairs){
    for (let pair of pairs){
        // console.log('>>', pair)
        if (pair.exchange === 'bittrex'){
            await axios.get(`https://bittrex.com/Api/v2.0/pub/market/GetLatestTick?marketName=${pair.label}&tickInterval=fiveMin`)
                .then(result => {
                    if (result.data.result !== null){
                        pair.price = Number(result.data.result[0].C)
                    }
                })
        }
        else if (pair.exchange == 'bitstamp'){
            await axios.get(`https://www.bitstamp.net/api/v2/ticker/${pair.label}`)
                .then(result => {
                    pair.price = Number(result.data.last)
                })
        }
        else if (pair.exchange == 'binnance'){
            await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${pair.label}`)
                .then(result => {
                    pair.price = Number(result.data.price)
                })
        }
        pair.timestamp = Math.floor(Date.now() / 1000)

    }
}





// console.log(pairs)

// import {pairs} from 'pairs'




// let pairsTemp = []
// for (let exchange in pairs){
//     for (let pairLabel in pairs[exchange]){
//         pairsTemp.push(pair(exchange, pairLabel))
//     }
// }



// const pairs_old = [
//     {
//         exchange: 'bitstamp',
//         baseCurrency: "usd",
//         quoteCurrency: "btc",
//         label: 'btcusd',
//         price: 6500,
//         timestamp: 33224524354
//     },
//     {
//         exchange: 'bittrex',
//         baseCurrency: "usd",
//         quoteCurrency: "btc",
//         label: 'btcusd',
//         price: 6496,
//         timestamp: 33224524354
//     },
//     {
//         exchange: 'coinbase',
//         baseCurrency: "usd",
//         quoteCurrency: "btc",
//         label: 'btcusd',
//         price: 6497,
//         timestamp: 33224524354
//     },
// ]