import axios from 'axios';
import { connectDb, getWithdrawFees } from '../database.js';
import { keys } from '../../keys/bittrex.js';
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

exchange._catchRequestResponseErrors = function(response) {
    if (!response.data.success) {
        throw Error(response.data.message);
    }
};

exchange._cleanMarketName = function(marketName) {
    const [baseCurrency, quoteCurrency] = marketName.split('/');
    return `${quoteCurrency}-${baseCurrency}`.toUpperCase();
};
exchange._request = async function(method, path, signed = false, args = {}) {
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
    return await this._makeRequest(exchange, path, requestConfig);
};
exchange.logThis = async function() {
    console.log(this);
};
exchange.getCurrencies = async function() {
    // proceed request
    const result = await this._request('get', '/api/v1.1/public/getcurrencies');

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
    const result = await this._request(
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

    const result = await this._request(
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
    const result = await this._request(
        'get',
        '/api/v1.1/account/getbalance',
        true,
        {
            currency: currencyName
        }
    );
    //TODO: throw error is symbol not found
    return result.result.Available;
};
exchange.getDepositAddress = async function(currencyName) {
    //TODO: // check for api error : ADDRESS_GENERATING
    const result = await this._request(
        'get',
        '/api/v1.1/account/getdepositaddress',
        true,
        {
            currency: currencyName
        }
    );
    // throw result.result;
    const returnedAddress = result.result.Address;
    if (!returnedAddress) {
        throw Error(
            `Deposit address for ${currencyName} on ${exchange.name} is empty`
        );
    }

    // if currency rely on tag address, get base address first
    let baseAddress;
    if (['xrp', 'xlm', 'lsk'].includes(currencyName)) {
        const result = await this._request(
            'get',
            '/api/v1.1/public/getcurrencies'
        );

        const currencies = result.result.filter(
            currency => currency.Currency == currencyName.toUpperCase()
        );
        if (currencies.length === 0) {
            throw Error('Cannot get currency base address');
        }
        baseAddress = currencies[0].BaseAddress;
    }

    let address;
    if (baseAddress) {
        address = { address: baseAddress, tag: returnedAddress };
    } else {
        address = { address: returnedAddress, tag: '' };
    }

    return address;
};
exchange.applyWithdrawFees = async function(currencyName, amount) {
    const db = connectDb();
    let currencyFees = await getWithdrawFees(db, exchange.name, currencyName);
    if (!currencyFees) {
        throw 'cannot get fees from database';
    }
    currencyFees = currencyFees[0];
    if (amount < currencyFees.withdrawMin) {
        throw `withdraw too low ${amount} < ${currencyFees.withdrawMin}`;
    }
    if (!currencyFees.withdrawEnabled) {
        throw 'withdraw disabled';
    }
    const withdrawOutput = amount - currencyFees.withdrawFee;
    return withdrawOutput;
};
exchange.applyTradingFees = function(amount) {
    return amount * (1 - exchange.tradingFees);
};
exchange.orderIsCompleted = async function(marketName, orderId) {
    const result = await this._request(
        'get',
        '/api/v1.1/account/getorderhistory'
    );

    if (result.result.length === 0) {
        throw Error('Bittrex return no order');
    }

    const matchingOrder = result.result.filter(
        order => order.OrderUuid === orderId
    );
    if (matchingOrder.length === 0) {
        throw Error('Order has not been found');
    }

    return matchingOrder[0].QuantityRemaining === 0;
};
exchange.withdrawIsCompleted = async function(withdrawId) {
    const result = await this._request(
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
        throw Error(`Withdraw ${withdrawId} not found!`);
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

    const result = await this._request(
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

    // const a = await exchange.getDepositAddress('xrp');

    const result = await this._request(
        'get',
        '/api/v1.1/account/getorderhistory'
    );

    console.log(result);
}
// test();

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
