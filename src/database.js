// import {getNodetypes} from '../common/utils.js'
import { Database, aql } from 'arangojs';
// import {listPairs} from './pairs.js'
import { getExchanges } from './exchanges';

export function connectDb() {
    const db = new Database('http://213.32.64.200:8529');
    db.useBasicAuth('root', 'arangodb');
    _createDatabase(db, 'cryptoBot_refactor');
    db.useDatabase('cryptoBot_refactor');
    return db;
}

async function _createDatabase(db, dbName) {
    // create zoa database
    const databases = await db.listDatabases();
    if (!databases.includes(dbName)) {
        db.createDatabase(dbName);
    }
}

export async function clearDatabase(db) {
    for (const collection of await db.listCollections()) {
        if (!collection.isSystem) {
            await db.collection(collection.name).drop();
        }
    }
}

export async function createDbNode(db, nodetypeName, nodeData) {
    const cursor = await db.query(aql`
        INSERT 
        ${nodeData}
        INTO ${db.collection(nodetypeName)}
        RETURN NEW
    `);
    const node = await cursor.next();
    // node._nodetypeName = nodetypeName
    return node;
}

export async function deleteDbNode(db, nodeId) {
    const collection = nodeId.split('/')[0];
    const cursor = await db.query(aql`
        REMOVE DOCUMENT(${nodeId}) in ${db.edgeCollection(collection)}
    `);
}

export async function setMarketData(db, marketLabel, data) {
    const cursor = await db.query(aql`
    FOR market IN markets FILTER market.label == ${marketLabel}
    UPDATE market WITH ${data} IN  ${db.edgeCollection('markets')}
    return market
    `);
}

export async function setCurrencyFees(db, exchangeName, currencyName, data) {
    const queryString = aql`
            FOR exchangeCurrencyEdge IN exchangeHasCurrency 
            FILTER document(exchangeCurrencyEdge._from).name == ${exchangeName} && document(exchangeCurrencyEdge._to).name == ${currencyName} 
            UPDATE exchangeCurrencyEdge WITH ${data} IN  ${db.edgeCollection(
        'exchangeHasCurrency'
    )}            
        `;
    // if (currencyName == 'neo') {
    //     console.log(queryString);
    // }
    await db.query(queryString);
}

export async function getWithdrawFees(db, exchangeName, currencyName) {
    const cursor = await db.query(aql`
            FOR exchangeCurrencyEdge IN exchangeHasCurrency 
            FILTER document(exchangeCurrencyEdge._from).name == ${exchangeName} && document(exchangeCurrencyEdge._to).name == ${currencyName} 
            RETURN exchangeCurrencyEdge
            
        `);
    return cursor.all();
}

export async function getArbitrageOpportunities(db, exchangeName, currency) {
    const queryString = aql`
    let walletCurrency = ${currency}
    let walletExchange = ${exchangeName}
    
    for srcExchange in exchanges filter srcExchange.name == walletExchange
    for srcCurrency in outbound srcExchange._id exchangeHasCurrency filter srcCurrency.name == walletCurrency
    for srcMarket, srcCurrencyEdge in inbound srcCurrency._id marketHasCurrency
    for checkSrcExchange in outbound srcMarket._id marketHasExchange filter checkSrcExchange._id == srcExchange._id
    
    for tmpCurrency in outbound srcMarket._id marketHasCurrency filter tmpCurrency._id != srcCurrency._id
    
    for dstMarket in inbound tmpCurrency._id marketHasCurrency filter dstMarket._id != srcMarket._id
    for dstCurrency, dstCurrencyEdge in outbound dstMarket._id marketHasCurrency filter dstCurrency._id == srcCurrency._id
    for dstExchange in outbound dstMarket._id marketHasExchange
    
    
    for checkSrcExchangeForTmpCurrency, e in inbound tmpCurrency._id exchangeHasCurrency filter checkSrcExchangeForTmpCurrency._id == srcExchange._id
    
    let withdrawalFees = e.withdrawalFees
    let srcTradingFees = srcExchange.tradingFees
    let dstTradingFees = dstExchange.tradingFees
    let srcPriceType = srcCurrencyEdge.type == 'quote' ? 'bid' : 'ask'
    let dstPriceType = dstCurrencyEdge.type == 'quote' ? 'ask' : 'bid'
    let srcPrice = srcPriceType == 'ask' ? srcMarket.askPrice : srcMarket.bidPrice
    let dstPrice = dstPriceType == 'ask' ? dstMarket.askPrice : dstMarket.bidPrice
    
    //filter srcPrice<dstPrice
    let srcPriceAdapted = srcPriceType == 'ask' ? srcPrice : 1/srcPrice
    let dstPriceAdapted = dstPriceType == 'ask' ? dstPrice : 1/dstPrice
    let ratio = ( srcPriceAdapted * ( 1 - srcTradingFees ) - withdrawalFees ) * dstPriceAdapted * (1 - dstTradingFees)
        
    sort ratio desc
    return distinct {
                    srcCurrency: srcCurrency.name,
                    srcExchange: srcExchange.name,
                    srcMarket: srcMarket.label,
                    srcPriceType,
                    srcPrice,
                    srcTradingFees,
                    tmpCurrency: tmpCurrency.name,
                    withdrawalFees,
                    dstExchange: dstExchange.name,
                    dstMarket: dstMarket.label,
                    dstPriceType,
                    dstPrice,
                    dstTradingFees,
                    ratio}
`;
    const cursor = await db.query(queryString);
    return cursor.all();
}

export async function updateDb(db) {
    for (const exchange of getExchanges()) {
        await updateMarkets(db, exchange);
        await updateCurrencies(db, exchange);
    }
}

async function updateMarkets(db, exchange) {
    const exchangeMarkets = await exchange.getMarkets();
    for (const marketName of Object.keys(exchangeMarkets)) {
        const marketLabel = `${exchange.name} - ${marketName}`;
        setMarketData(db, marketLabel, exchangeMarkets[marketName]);
    }
}

async function updateCurrencies(db, exchange) {
    const exchangeCurrencies = await exchange.getCurrencies();
    // console.log('>>', exchangeCurrencies.neo);
    for (const currencyName of Object.keys(exchangeCurrencies)) {
        setCurrencyFees(
            db,
            exchange.name,
            currencyName,
            exchangeCurrencies[currencyName]
        );
    }
}

// async function test() {
//     const db = await connectDb()
//     const a = await getArbitrageOpportunities(db, 'bittrex', 'btc')
//     a
//     return a
// }

async function tt() {
    const db = connectDb();
    await setCurrencyFees(db, 'binance', 'neo', {
        withdrawEnabled: false,
        depositEnabled: false
    });
}

tt();
