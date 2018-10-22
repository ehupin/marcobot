import { connectDb, getWithdrawFees } from '../database.js';
import { keys } from '../../keys/binance.js';

const crypto = require('crypto');
const qs = require('qs');
const deepmerge = require('deepmerge');

const exchange = {
    name: 'binance',
    tradingFees: 0.001
};

exchange._cleanMarketName = function(marketName) {
    return marketName.replace('/', '').toUpperCase();
};

exchange._getMarketsPrices = async function() {
    const result = await this._request('get', '/api/v1/ticker/24hr');
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
exchange._request = async function(method, path, signed = false, args = {}) {
    // add timestamp to args and stringify the args
    if (signed) {
        const currentTimestamp = new Date().getTime();
        args.timestamp = currentTimestamp;
        args.recvWindow = 20000;
    }
    const dataQueryString = qs.stringify(args);

    // build url, add signature if required
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
    return await this._makeRequest(exchange, path, requestConfig);
};
exchange.getCurrencies = async function() {
    // proceed request
    const result = await this._request(
        'get',
        '/wapi/v3/assetDetail.html',
        true
    );
    // return 5;
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
exchange.getMarkets = async function() {
    // proceed request
    const result = await this._request('get', '/api/v1/exchangeInfo');
    // build market objects
    let markets = {};
    for (const remotePair of result.symbols) {
        markets[remotePair.symbol] = {
            baseCurrency: remotePair.baseAsset.toLowerCase(),
            quoteCurrency: remotePair.quoteAsset.toLowerCase(),
            minTradeAmount: Number(remotePair.filters[1].minQty),
            maxTradeAmount: Number(remotePair.filters[1].maxQty),
            minTradeStep: Number(remotePair.filters[1].stepSize)
        };
    }

    // update them with prices
    const marketsUpdates = await this._getMarketsPrices();
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

exchange.getOrderBook = async function(marketName, type) {
    // build market symbol and process request
    const symbol = marketName.replace('/', '').toUpperCase();
    const result = await this._request('get', '/api/v1/depth', null, {
        symbol
    });

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

exchange.getWalletAmount = async function(currencyName) {
    const result = await this._request('get', '/api/v3/account', true);
    for (const asset of result.balances) {
        if (asset.asset.toLowerCase() == currencyName) {
            return Number(asset.free);
        }
    }
};
exchange.getDepositAddress = async function(currencyName) {
    const result = await this._request(
        'get',
        '/wapi/v3/depositAddress.html',
        true,
        {
            asset: currencyName
        }
    );
    return {
        address: result.address,
        tag: result.addressTag
    };
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
    //TODO: deal with invalid parameters (e.g. id not found)
    marketName = this._cleanMarketName(marketName);
    const result = await this._request('get', '/api/v3/order', true, {
        symbol: marketName,
        origClientOrderId: orderId,
        timestamp: Date.now()
    });
    //TODO: raise exception or manage situation if order cannot have been completed (order status on https://github.com/binance-exchange/binance-official-api-docs/blob/master/rest-api.md)
    return result.status === 'FILLED';
};
exchange.withdrawIsCompleted = async function(withdrawId) {
    const result = await this._request(
        'get',
        '/wapi/v3/withdrawHistory.html',
        true,
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
        throw Error(`Withdraw ${withdrawId} not found!`);
    }

    return false;
};
exchange.depositIsCompleted = async function(amount, currencyName) {
    const result = await this._request(
        'get',
        '/wapi/v3/depositHistory.html',
        true,
        {
            timestamp: Date.now()
        }
    );
    // return result;
    currencyName = currencyName.toUpperCase();
    let found = false;
    for (const deposit of result.depositList) {
        if (deposit.amount == amount && deposit.asset == currencyName) {
            found = true;
            if (deposit.status === 1) {
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
    const tradingFees = (await exchange.getMarkets())[marketName];
    const step = Number(tradingFees.minTradeStep);

    // setup base request data
    const data = {
        symbol: this._cleanMarketName(marketName),
        side: type.toUpperCase(),
        type: 'MARKET',
        newOrderRespType: 'FULL',
        recvWindow: 10000
    };

    // because binance do not take fees from orderAmount, orderAmount should be
    // decreased until binance consider there is enough amount left on wallet for the fees
    //TODO: this is more supposition thant somnething confirmed by online ressource
    let orderAmount;
    let result;
    for (
        orderAmount = amount;
        orderAmount > amount * 0.95;
        orderAmount -= step * 10 //TODO: does this step is too large?
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

            result = await this._request('post', '/api/v3/order', true, data);
        } catch (e) {
            if (e.response.data.code == -2010) {
                continue;
            }
            throw e;
        }

        // const returnedOrder = {
        //     id: result.clientOrderId
        // };
        return result.clientOrderId;
    }
};
exchange.makeWithdrawal = async function(currencyName, amount, address) {
    const data = {
        asset: currencyName,
        address: address.address,
        addressTag: address.addressTag,
        amount,
        recvWindow: 10000,
        timestamp: Date.now()
    };

    return await this._request('post', '/wapi/v3/withdraw.html', data);
};

export default exchange;
