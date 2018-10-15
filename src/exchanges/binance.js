import { inspect } from 'util';

import axios from 'axios';

import { signedRequest } from '../signedRequest.js';
import { connectDb, getWithdrawFees } from '../database.js';

import { keys } from '../../keys/binance.js';

import { logger } from '../loggers';

const fs = require('fs');
const crypto = require('crypto');
const qs = require('qs');

const cheerio = require('cheerio');
const deepmerge = require('deepmerge');

const exchange = {
    name: 'binance',
    tradingFees: 0.001
};

exchange._getMarketsPrices = async function(request) {
    const result = await request('get', '/api/v1/ticker/24hr');
    const markets = {};
    for (const market of result) {
        markets[market.symbol] = {
            bidPrice: Number(market.bidPrice),
            askPrice: Number(market.askPrice),
            baseVolume: Number(market.volume),
            quoteVolume: Number(market.quoteVolume)
        };
    }
    return markets;
};
exchange._signedRequest = async function(method, path, args = {}) {
    const currentTimestamp = new Date().getTime();
    const dataQueryString = qs.stringify(
        Object.assign(args, { timestamp: currentTimestamp })
    );
    const signature = crypto
        .createHmac('sha256', keys.API_SECRET)
        .update(dataQueryString)
        .digest('hex');
    const requestConfig = {
        method,
        url: `https://api.binance.com${path}?${dataQueryString}&signature=${signature}`,
        headers: {
            'X-MBX-APIKEY': keys.API_KEY
        }
    };
    //   console.log(requestConfig)
    //   return

    try {
        const response = await axios(requestConfig);
        return response.data;
    } catch (e) {
        console.log(e.response.data);
        throw e;
    }
};
exchange._request = async function(method, path, signed = false, args = {}) {
    // add timestamp to args and stringify the args

    if (signed) {
        const currentTimestamp = new Date().getTime();
        args.timestamp = currentTimestamp;
        args.recvWindow = 20000;
    }

    const dataQueryString = qs.stringify(args);

    // build url, including url if required
    let url = `https://api.binance.com${path}?${dataQueryString}`;

    if (signed) {
        const signature = crypto
            .createHmac('sha256', keys.API_SECRET)
            .update(dataQueryString)
            .digest('hex');
        url += `&signature=${signature}`;
    }

    // build request config
    const requestConfig = {
        method,
        url,
        headers: {
            'X-MBX-APIKEY': keys.API_KEY
        }
    };

    try {
        logger.log('debug', `Binance api call ${url}`);
        const response = await axios(requestConfig);
        console.log(response.data);
        return response.data;
    } catch (e) {
        let message = `Binance api call has failed: ${e.message}`;
        if (e.response) {
            message += `\n\tAxios related error: ${JSON.stringify(
                e.response.data
            )}`;
        }
        logger.log('error', message);
        throw e;
    }
};
exchange.getCurrencies = async function(request = exchange._request) {
    // proceed request
    const result = await request('get', '/wapi/v3/assetDetail.html', true);

    // build currencies, and store thenm in an object using currencyName as keys
    const rawCurrencies = result.assetDetail;
    const currencies = {};
    for (const currencyName in rawCurrencies) {
        currencies[currencyName.toLowerCase()] = {
            withdrawEnabled: rawCurrencies[currencyName].withdrawStatus,
            withdrawMin: rawCurrencies[currencyName].minWithdrawAmount,
            withdrawFee: rawCurrencies[currencyName].withdrawFee,
            depositEnabled: rawCurrencies[currencyName].depositStatus
        };
    }
    return currencies;
};
exchange.getMarkets = async function(request = exchange._request) {
    // proceed request
    const apiResult = await request('get', '/api/v1/exchangeInfo');

    // build market objects
    let markets = {};
    for (const remotePair of apiResult.symbols) {
        markets[remotePair.symbol] = {
            baseCurrency: remotePair.baseAsset.toLowerCase(),
            quoteCurrency: remotePair.quoteAsset.toLowerCase(),
            minTradeAmount: remotePair.filters[1].minQty,
            maxTradeAmount: remotePair.filters[1].maxQty,
            minTradeStep: remotePair.filters[1].stepSize
        };
    }

    // update them with prices
    const marketsUpdates = await this._getMarketsPrices(req);
    markets = deepmerge(markets, marketsUpdates);

    // store markets in object, using labels as keys
    const labeledMarkets = {};
    for (const marketSymbol in markets) {
        const market = markets[marketSymbol];
        const label = `${market.baseCurrency}/${market.quoteCurrency}`;
        labeledMarkets[label] = market;
    }
    return labeledMarkets;
};

exchange.getOrderBook = async function(
    marketName,
    type,
    request = exchange.request
) {
    // build market symbol and process request
    const symbol = marketName.replace('/', '').toUpperCase();
    const result = await request('get', '/api/v1/depth', null, { symbol });

    // build orders and store them in an array
    const rawOrders = result[`${type}s`];
    const orders = [];
    for (const order of rawOrders) {
        orders.push({
            price: Number(order[0]),
            amount: Number(order[1])
        });
    }
    return orders;
};

exchange.getWalletAmount = async function(
    currencyName,
    request = exchange._request
) {
    const result = await request('get', '/api/v3/account', true);
    for (const asset of result.balances) {
        if (asset.asset.toLowerCase() == currencyName) {
            return Number(asset.free);
        }
    }
};
exchange.getDepositAddress = async function(
    currencyName,
    request = exchange._request
) {
    const result = await request('get', '/wapi/v3/depositAddress.html', true, {
        asset: currencyName
    });
    return {
        address: result.address,
        tag: result.addressTag,
        url: result.url
    };
};
exchange.applyWithdrawFees = async function(currencyName, srcTradeOutput) {
    const db = connectDb();
    const currencyFees = await getWithdrawFees(db, this.name, currencyName);
    if (!currencyFees) {
        throw 'cannot get fees from database';
    }
    if (srcTradeOutput < currencyFees[0].withdrawMin) {
        throw `withdraw too low ${srcTradeOutput} < ${
            currencyFees[0].withdrawMin
        }`;
    }
    if (!currencyFees[0].withdrawEnabled) {
        throw 'withdraw disabled';
    }
    const withdrawOutput = srcTradeOutput - currencyFees[0].withdrawFee;
    return withdrawOutput;
};
exchange.applyTradingFees = async function(srcTradeOutput) {
    return srcTradeOutput * (1 - this.tradingFees);
};
exchange.orderIsCompleted = async function(marketName, orderId) {
    marketName = marketName.replace('/', '').toUpperCase();
    const result = await this._signedRequest('get', '/api/v3/order', {
        symbol: marketName,
        orderId,
        timestamp: Date.now()
    });
    return result.status === 'FILLED';
};
exchange.withdrawIsCompleted = async function(withdrawId) {
    const result = await this._signedRequest(
        'get',
        '/wapi/v3/withdrawHistory.html',
        {
            timestamp: Date.now()
        }
    );

    let found = false;
    for (const withdraw of result.withdrawList) {
        if (withdraw.id === withdrawId) {
            found = true;
            if (withdraw.status === 6) {
                return true;
            }
        }
    }

    if (!found) {
        throw `Withdraw ${withdrawId} not found!`;
    }

    return false;
};
exchange.depositIsCompleted = async function(amount, currencyName) {
    const result = await this._signedRequest(
        'get',
        '/wapi/v3/depositHistory.html',
        {
            timestamp: Date.now()
        }
    );

    currencyName = currencyName.toUpperCase();
    let found = false;
    for (const withdraw of result.depositList) {
        if (withdraw.amount == amount && withdraw.asset == currencyName) {
            found = true;
            if (withdraw.status === 1) {
                return true;
            }
        }
    }

    if (!found) {
        throw `Deposit of ${amount} ${currencyName} not found!`;
    }

    return false;
};
exchange.placeOrder = async function(marketName, amount, type) {
    const tradingFees = (await this.getMarkets())[marketName];
    const step = Number(tradingFees.minTradeStep);

    // setup base request data
    const data = {
        symbol: marketName.replace('/', '').toUpperCase(),
        side: type.toUpperCase(),
        type: 'MARKET',
        newOrderRespType: 'FULL',
        recvWindow: 10000
    };

    let orderAmount;
    let result;
    for (
        orderAmount = amount;
        orderAmount > amount * 0.95;
        orderAmount -= step * 10
    ) {
        try {
            // adjust order amount to match trading rules
            // e.g. step=0.001 | amount 123.45678 => 123.456
            const adjustedOrderAmount =
                Math.trunc(orderAmount * (1 / step)) * step;

            console.log('Trading', {
                amount,
                orderAmount,
                adjustedOrderAmount
            });

            // update request data
            data.quantity = adjustedOrderAmount;
            data.timestamp = Date.now();

            result = await this._signedRequest('post', '/api/v3/order', data);
        } catch (e) {
            if (e.response.data.code == -2010) {
                continue;
            }
            throw e;
        }
        console.log('$$$$$$$$$$$$$$');
        console.log(result.data);

        const returnedOrder = {
            id: result.orderId,
            time: result.transactionTime
        };
        return result;
    }
};
exchange.makeWithdrawal = async function(
    currencyName,
    amount,
    address,
    addressTag
) {
    const data = {
        asset: currencyName,
        address,
        amount,
        recvWindow: 10000,
        timestamp: Date.now()
    };

    return await this._signedRequest('post', '/wapi/v3/withdraw.html', data);
};

export default exchange;

async function test() {
    // const amount = await binance.getWalletAmount('xrp')
    // console.log(amount)

    // const amount = await binance.makeWithdrawal('btc',
    //                                             0.01,
    //                                             '37HupeVwMQjSCVA9BdEkkX56hzyBwqBBD5')

    // let amount = await binance.makeTrade('gto/btc', 1, 'buy')
    // console.log(amount)

    // const result = await binance._signedRequest('get','/wapi/v3/withdrawHistory.html',
    //                                             {
    //                                                 timestamp: Date.now()
    //                                             })
    // console.log(result)

    // return

    // let amount = await binance.depositIsCompleted(0.0494, 'btc')
    // const amount = await binance.withdrawIsCompleted(0.0494, 'btc');
    // console.log(amount);
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

    const a = await exchange.getDepositAddress('btc');
    // console.log(a)
}
test();

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
