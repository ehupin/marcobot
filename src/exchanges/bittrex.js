import axios from 'axios';
import { connectDb, getWithdrawFees } from '../database.js';
import { keys } from '../../keys/binance.js';
import { logger } from '../loggers';

const fs = require('fs');
const crypto = require('crypto');
const qs = require('qs');

const cheerio = require('cheerio');
const deepmerge = require('deepmerge');

const exchange = {
    name: 'bittrex',
    tradingFees: 0.0025
};

exchange._cleanMarketName = function(marketName) {
    const [baseCurrency, quoteCurrency] = marketName.split('/');
    return `${quoteCurrency}-${baseCurrency}`.toUpperCase();
};
exchange._request = async function(method, path, signed = false, args = {}) {
    //! 'signed' parameter is ignore for the moment
    const nonce = Date.now();
    args = Object.assign(args, {
        nonce,
        apikey: keys.API_KEY
    });

    const dataQueryString = qs.stringify(args);
    const url = `https://bittrex.com${path}?${dataQueryString}`;
    const signature = crypto
        .createHmac('sha512', keys.API_SECRET)
        .update(url)
        .digest('hex');

    const requestConfig = {
        method,
        url,
        headers: {
            apisign: signature
        }
    };

    try {
        const response = await axios(requestConfig);
        // console.log('>>', response.data.result);
        if (!response.data.success) {
            throw Error(`request has failed: ${response.data.message}`);
        }

        return response.data;
    } catch (e) {
        let message = `Bittrex api call has failed: ${e.message}`;
        if (e.response) {
            message += `\n\tAxios related error: ${JSON.stringify(
                e.response.data
            )}`;
        }
        logger.log('error', message);
        throw e;
    }
};
exchange.getCurrencies = async function() {
    // proceed request
    const result = await exchange._request(
        'get',
        '/api/v1.1/public/getcurrencies'
    );

    const rawCurrencies = result.result;
    const currencies = {};
    for (const currency of rawCurrencies) {
        currencies[currency.Currency.toLowerCase()] = {
            withdrawEnabled: currency.IsActive,
            withdrawMin: currency.TxFee * 3,
            withdrawFee: currency.TxFee,
            depositEnabled: currency.IsActive
        };
    }
    return currencies;
};
exchange.getMarkets = async function() {
    // proceed request
    const result = await exchange._request(
        'get',
        '/api/v2.0/pub/markets/GetMarketSummaries'
    );
    //TODO: check if query result is not empty object

    const markets = {};
    for (const rawMarket of result.result) {
        const market = {
            baseCurrency: rawMarket.Market.MarketCurrency.toLowerCase(),
            quoteCurrency: rawMarket.Market.BaseCurrency.toLowerCase(),
            bidPrice: rawMarket.Summary.Bid,
            askPrice: rawMarket.Summary.Ask,
            baseVolume: rawMarket.Summary.Volume,
            quoteVolume: rawMarket.Summary.BaseVolume,
            maxTradeAmount: Number.MAX_VALUE,
            minTradeStep: 0
        };

        // build label and add it to markets object
        const label = `${market.baseCurrency}/${market.quoteCurrency}`;
        markets[label] = market;
    }

    Object.keys(markets).map(marketName => {
        let market = markets[marketName];
        let minTradeAmount;
        const btcMinTradeAmount = 0.0005;
        if (market.baseCurrency == 'btc') {
            minTradeAmount = btcMinTradeAmount;
        } else if (market.quoteCurrency == 'btc') {
            minTradeAmount = market.bidPrice * btcMinTradeAmount;
        } else {
            const btcRelatedMarket = markets[`${market.baseCurrency}/btc`];
            minTradeAmount = btcRelatedMarket
                ? btcRelatedMarket.bidPrice * btcMinTradeAmount
                : 0;
        }
        market.minTradeAmount = minTradeAmount;
    });
    return markets;
};

exchange.getOrderBook = async function(marketName, type) {
    marketName = this._cleanMarketName(marketName);
    type = type == 'bid' ? 'buy' : type;
    type = type == 'ask' ? 'sell' : type;

    const result = await exchange._request(
        'get',
        '/api/v1.1/public/getorderbook',
        true,
        {
            market: marketName,
            type
        }
    );

    const orders = [];
    for (const order of result.result) {
        orders.push({
            price: order.Rate,
            amount: order.Quantity
        });
    }
    return orders;
};

exchange.getWalletAmount = async function(currencyName) {
    const result = await exchange._request(
        'get',
        '/api/v1.1/account/getbalance',
        true,
        {
            currency: currencyName
        }
    );

    return result.result.Available;
};
exchange.getDepositAddress = async function(currencyName) {
    const result = await exchange._request(
        'get',
        '/api/v1.1/account/getdepositaddress',
        true,
        {
            currency: currencyName
        }
    );

    return result.result.Address;
};
exchange.applyWithdrawFees = async function(currencyName, amount) {
    if (srcTradeOutput < currencyFees.withdrawMin) {
        throw 'withdraw disabled';
    }
    const db = connectDb();
    const currencyFees = await getWithdrawFees(db, this.name, currencyName);
    if (!currencyFees.withdrawEnabled) {
        throw 'withdraw disabled';
    }
    const withdrawOutput = srcTradeOutput - currencyFees.withdrawFee;
    return withdrawOutput;
};
exchange.applyTradingFees = async function(amount) {
    return amount * (1 - this.tradingFees);
};
exchange.orderIsCompleted = async function(marketName, orderId) {
    throw Error('Not implemented');
};
exchange.withdrawIsCompleted = async function(withdrawId) {
    const result = await exchange._request(
        'get',
        '/api/v1.1/account/getwithdrawalhistory'
    );

    let found = false;
    for (const withdraw of result.result) {
        if (withdraw.PaymentUuid === withdrawId) {
            found = true;
            if (withdraw.Authorized && !withdraw.PendingPayment) {
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
    throw Error('Not implemented');
};
exchange.placeOrder = async function(marketName, amount, type) {
    throw Error('Not implemented');
};
exchange.makeWithdrawal = async function(
    currencyName,
    amount,
    address,
    addressTag
) {
    const data = {
        currency: currencyName,
        quantity: amount,
        address,
        paymentid: addressTag
    };

    const result = await exchange._request(
        'get',
        '/api/v1.1/account/withdraw',
        data
    );

    return { id: result.uuid };
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

    const a = await exchange.getMarkets();
    console.log(a);
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
