import {getExchanges} from '../exchanges.js'
import {connectDb, setMarketData, setCurrencyFees} from '../database.js'

export async function updateDb(){
    
    const db = connectDb()
    for (const exchange of getExchanges()){
        await updateMarkets(db, exchange)
        await updateCurrencies(db, exchange)
    }
}

async function updateMarkets(db, exchange){
    const exchangeMarkets = await exchange.getMarkets()
    for (const marketName of Object.keys(exchangeMarkets)){
        const marketLabel = `${exchange.name} - ${marketName}`
        await setMarketData(db, marketLabel, exchangeMarkets[marketName])
    }
}


async function updateCurrencies(db, exchange){
    const exchangeCurrencies = await exchange.getCurrencies()
    for (const currencyName of Object.keys(exchangeCurrencies)){
        await setCurrencyFees(db, 
                            exchange.name, 
                            currencyName, 
                            exchangeCurrencies[currencyName])
    }
}