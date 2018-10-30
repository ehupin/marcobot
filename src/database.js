// import {getNodetypes} from '../common/utils.js'
import { Database, aql } from 'arangojs';
// import {listPairs} from './pairs.js'
import { getExchanges } from './exchanges';
import { cursorTo } from 'readline';
import { logger } from './loggers';
import { sleep } from './utilities';

const DATABASE_NAME = 'cryptoBot_refactor';

export function connectDb(setDatabase = true) {
    let db, errorMessage;
    for (let i = 0; i < 5; i += 1) {
        try {
            db = new Database({
                url: 'http://213.32.64.200:8529'
                // maxRetries: 5
            });
        } catch (e) {
            errorMessage = `Database connection failed: ${e.message}`;
            logger.error(errorMessage);
            // await sleep(200);
        }
    }

    if (!db) {
        throw Error(errorMessage);
    }

    db.useBasicAuth('root', 'arangodb');

    if (setDatabase) {
        db.useDatabase(DATABASE_NAME);
    }
    return db;
}
/*
Wrap the db.query function in a try/catch allowing multiple attempts in case of error
*/
async function _query(db, aqlString) {
    let errorMessage;
    for (let i = 0; i < 10; i += 1) {
        try {
            const result = await db.query(aqlString);
            return result;
        } catch (e) {
            errorMessage = `Database query failed: ${e.message}`;
            logger.error(errorMessage);
            await sleep(1000);
        }
    }
    throw Error('Too many attempts - ' + errorMessage);
}

export async function createDatabase(db) {
    // create zoa database
    const databases = await db.listDatabases();
    if (!databases.includes(DATABASE_NAME)) {
        db.createDatabase(DATABASE_NAME);
    }
    db.useDatabase(DATABASE_NAME);
}

export async function clearDatabase(db) {
    for (const collection of await db.listCollections()) {
        if (!collection.isSystem) {
            await db.collection(collection.name).drop();
        }
    }
}

export async function createDbNode(db, nodetypeName, nodeData) {
    const cursor = await _query(
        db,
        aql`
        INSERT 
        ${nodeData}
        INTO ${db.collection(nodetypeName)}
        RETURN NEW
    `
    );
    const node = await cursor.next();
    // node._nodetypeName = nodetypeName
    return node;
}

export async function deleteDbNode(db, nodeId) {
    const collection = nodeId.split('/')[0];
    const cursor = await _query(
        db,
        aql`
        REMOVE DOCUMENT(${nodeId}) in ${db.edgeCollection(collection)}
    `
    );
}

export async function setMarketData(db, marketLabel, data) {
    const cursor = await _query(
        db,
        aql`
    FOR market IN markets FILTER market.label == ${marketLabel}
    UPDATE market WITH ${data} IN  ${db.edgeCollection('markets')}
    return market
    `
    );
}

export async function setCurrencyFees(db, exchangeName, currencyName, data) {
    const queryString = aql`
            FOR exchangeCurrencyEdge IN exchangeHasCurrency 
            FILTER document(exchangeCurrencyEdge._from).name == ${exchangeName} && document(exchangeCurrencyEdge._to).name == ${currencyName} 
            UPDATE exchangeCurrencyEdge WITH ${data} IN  ${db.edgeCollection(
        'exchangeHasCurrency'
    )}            
        `;
    await _query(db, queryString);
}

export async function getWithdrawFees(db, exchangeName, currencyName) {
    const cursor = await _query(
        db,
        aql`
            FOR exchangeCurrencyEdge IN exchangeHasCurrency 
            FILTER document(exchangeCurrencyEdge._from).name == ${exchangeName} && document(exchangeCurrencyEdge._to).name == ${currencyName} 
            RETURN exchangeCurrencyEdge
            
        `
    );
    return cursor.next();
}
export async function getWalletStatus(db, exchangeName, currencyName) {
    const queryString = aql`
            FOR exchangeCurrencyEdge IN exchangeHasCurrency 
            FILTER document(exchangeCurrencyEdge._from).name == ${exchangeName} 
            && document(exchangeCurrencyEdge._to).name == ${currencyName} 
            RETURN {
                withdrawEnabled: exchangeCurrencyEdge.withdrawEnabled,
                depositEnabled: exchangeCurrencyEdge.depositEnabled
            }
        `;
    const cursor = await _query(db, queryString);
    return cursor.next();
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
    
    let withdrawalFees = e.withdrawFees
    let srcTradingFees = srcExchange.tradingFees
    let dstTradingFees = dstExchange.tradingFees
    let srcPriceType = srcCurrencyEdge.type == 'quote' ? 'ask' : 'bid'
    let dstPriceType = dstCurrencyEdge.type == 'quote' ? 'bid' : 'ask'
    let srcPrice = srcPriceType == 'ask' ? srcMarket.askPrice : srcMarket.bidPrice
    let dstPrice = dstPriceType == 'ask' ? dstMarket.askPrice : dstMarket.bidPrice
    
    //filter srcPrice<dstPrice
    let srcPriceAdapted = srcPriceType == 'ask' ? srcPrice : 1/srcPrice
    let dstPriceAdapted = dstPriceType == 'ask' ? dstPrice : 1/dstPrice
    let ratio = ( srcPriceAdapted * ( 1 - srcTradingFees ) - withdrawalFees ) * dstPriceAdapted * (1 - dstTradingFees)
    
    filter ratio > 1

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
    const cursor = await _query(db, queryString);
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
        logger.debug(`Update market ${marketLabel}`);
        await setMarketData(db, marketLabel, exchangeMarkets[marketName]);
    }
}

async function updateCurrencies(db, exchange) {
    const exchangeCurrencies = await exchange.getCurrencies();
    for (const currencyName of Object.keys(exchangeCurrencies)) {
        logger.debug(`Update currency ${currencyName} on ${exchange.name}`);
        await setCurrencyFees(
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
    // console.time('update');
    const db = connectDb();
    const w = await getWalletStatus(db, 'binance', 'btc');
    console.log(w);

    // console.timeEnd('update');
    // console.time('getarb');
    // const result = await getArbitrageOpportunities(db, 'binance', 'btc');
    // console.timeEnd('getarb');
    // // console.log(result.map(arbitrage => arbitrage.ratio));
}

// tt();
