import { connectDb, getWithdrawFees } from '../database.js';
import { keys } from '../../keys/bittrex.js';

const crypto = require('crypto');
const qs = require('qs');

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
    // build args object with nonce and api key
    const nonce = Date.now();
    args = Object.assign(args, {
        nonce,
        apikey: keys.API_KEY
    });

    // build url using strigified args
    const dataQueryString = qs.stringify(args);
    const url = `https://bittrex.com${path}?${dataQueryString}`;

    // create signature
    //TODO: should it be done just for signed requests
    const signature = crypto
        .createHmac('sha512', keys.API_SECRET)
        .update(url)
        .digest('hex');

    // make request config
    const requestConfig = {
        method,
        url,
        headers: {
            apisign: signature
        }
    };

    // run request, get result
    const requestResult = await this._makeRequest(
        exchange,
        path,
        requestConfig
    );

    // throw error if requestResult does not have key 'result'
    if (!Object.keys(requestResult).includes('result')) {
        throw Error('Bittrex api call result does not contain result.');
    }

    return requestResult.result;
};

exchange.getCurrencies = async function() {
    // proceed request
    const result = await this._request('get', '/api/v1.1/public/getcurrencies');

    const rawCurrencies = result;
    const currencies = {};
    // TODO: What is the withdraw min on bittrex ??
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
    for (const rawMarket of result) {
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
    for (const order of result) {
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
    return result.Available;
};
exchange.getDepositAddress = async function(currencyName) {
    //TODO: check for api error : ADDRESS_GENERATING
    const result = await this._request(
        'get',
        '/api/v1.1/account/getdepositaddress',
        true,
        {
            currency: currencyName
        }
    );
    // throw result;
    const returnedAddress = result.Address;
    if (!returnedAddress) {
        throw Error(
            `Deposit address for ${currencyName} on ${exchange.name} is empty`
        );
    }

    // if currency rely on tag address, get base address first
    let baseAddress;
    //TODO: check if other currencies require base address
    if (['xrp', 'xlm', 'lsk'].includes(currencyName)) {
        const result = await this._request(
            'get',
            '/api/v1.1/public/getcurrencies'
        );

        const currencies = result.filter(
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
exchange.applyTradingFees = async function(amount) {
    return amount * (1 - exchange.tradingFees);
};
exchange.orderIsCompleted = async function(marketName, orderId) {
    const result = await this._request(
        'get',
        '/api/v1.1/account/getorderhistory'
    );

    if (result.length === 0) {
        throw Error('Bittrex return no order');
    }

    const matchingOrder = result.filter(order => order.OrderUuid === orderId);
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
    for (const withdraw of result) {
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
