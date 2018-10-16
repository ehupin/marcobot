// const { getWithdrawFees } = require('../../database');
import { getWithdrawFees } from '../../database';
jest.mock('../../database');

import exchange from '../binance';
// jest.mock('../binance');

const requestApiOutput = {
    getMarkets_1: {
        symbols: [
            {
                baseAsset: 'xrp',
                quoteAsset: 'btc',
                filters: [
                    {},
                    {
                        minQty: 1,
                        maxQty: 100,
                        stepSize: 0.5
                    }
                ]
            }
        ]
    },
    getMarkets_2: [
        {
            bidPrice: 100,
            askPrice: 120,
            volume: 10000,
            quoteVolume: 10000
        }
    ],
    getCurrencies: {
        assetDetail: {
            BTC: {
                minWithdrawAmount: 71.6,
                depositStatus: true,
                withdrawFee: 35.8,
                withdrawStatus: true
            }
        }
    },
    getOrderBook: {
        lastUpdateId: 328749522,
        bids: [['0.03096500', '2.12400000'], ['0.03095600', '8.65600000']],
        asks: [['0.03236500', '4.32600000'], ['0.03245600', '9.33600000']]
    },
    getWalletAmount: { balances: [{ asset: 'BTC', free: 0.5 }] },
    getDepositAddress: {
        address: '1Cx7NX9w5WomnPMTQJVjUYMVD9QUYp37De',
        addressTag: ''
    },
    orderIsCompleted_isCompleted: { status: 'FILLED' },
    orderIsCompleted_isNotCompleted: { status: 'INPROCESS' },
    withdrawIsCompleted_isCompleted: {
        withdrawList: [{ id: '123456', status: 6 }]
    },
    withdrawIsCompleted_isNotCompleted: {
        withdrawList: [{ id: '123456', status: 4 }]
    },
    withdrawIsCompleted_isNotFound: {
        withdrawList: [{ id: '123456', status: 4 }]
    },
    depositIsCompleted_isCompleted: {
        depositList: [{ amount: 12, asset: 'btc', status: 1 }]
    },
    depositIsCompleted_isNotCompleted: {
        depositList: [{ amount: 12, asset: 'btc', status: 0 }]
    }
};

test('Get markets', () => {
    exchange._request = jest
        .fn()
        .mockResolvedValueOnce(requestApiOutput.getMarkets_1)
        .mockResolvedValueOnce(requestApiOutput.getMarkets_2);

    return exchange.getMarkets().then(markets => {
        expect(markets).toEqual(expect.any(Object));
        expect(markets).not.toEqual({});
        Object.keys(markets).map(marketLabel => {
            const market = markets[marketLabel];
            expect(market).toMatchObject({
                baseCurrency: expect.any(String),
                quoteCurrency: expect.any(String),
                minTradeAmount: expect.any(Number),
                minTradeStep: expect.any(Number),
                bidPrice: expect.any(Number),
                askPrice: expect.any(Number),
                baseVolume: expect.any(Number),
                quoteVolume: expect.any(Number)
            });
            expect(marketLabel).toBe(
                `${market.baseCurrency}/${market.quoteCurrency}`
            );
        });
    });
});

test('Get currencies', () => {
    exchange._request = jest
        .fn()
        .mockResolvedValueOnce(requestApiOutput.getCurrencies);

    return exchange.getCurrencies().then(currencies => {
        expect(currencies).toEqual(expect.any(Object));
        expect(currencies).not.toEqual({});
        Object.keys(currencies).map(currencyName => {
            const currency = currencies[currencyName];
            expect(currency).toMatchObject({
                withdrawEnabled: expect.any(Boolean),
                withdrawMin: expect.any(Number),
                withdrawFee: expect.any(Number),
                depositEnabled: expect.any(Boolean)
            });
        });
    });
});

test('Get order book', () => {
    exchange._request = jest
        .fn()
        .mockResolvedValueOnce(requestApiOutput.getOrderBook);

    return exchange.getOrderBook('btc/usd', 'ask').then(orders => {
        expect(orders).toEqual(expect.any(Array));
        expect(orders).not.toEqual([]);
        orders.map(order => {
            expect(order).toMatchObject({
                price: expect.any(Number),
                amount: expect.any(Number)
            });
        });
    });
});

test('Get wallet amount', () => {
    exchange._request = jest
        .fn()
        .mockResolvedValueOnce(requestApiOutput.getWalletAmount);

    return exchange
        .getWalletAmount('btc')
        .then(orders => expect(orders).toEqual(expect.any(Number)));
});

test('Get deposit address', () => {
    exchange._request = jest
        .fn()
        .mockResolvedValueOnce(requestApiOutput.getDepositAddress);

    // TODO: what happened if parameter is empty ?
    return exchange.getDepositAddress('btc').then(address => {
        expect(address.address).toEqual(expect.any(String));
        expect(address.address).not.toEqual('');
        expect(address.tag).toEqual(expect.any(String));
    });
});

test('Apply withdraw fees', () => {
    getWithdrawFees.mockResolvedValue([
        {
            withdrawMin: 0.1,
            withdrawFee: 0.01,
            withdrawEnabled: true
        }
    ]);

    return exchange.applyWithdrawFees('btc', 0.5).then(result => {
        expect(result).toEqual(0.49);
    });
});

test('Apply trading fees', () => {
    const amount = 100;
    expect(exchange.tradingFees).toEqual(expect.any(Number));
    return exchange.applyTradingFees(amount).then(result => {
        //TODO: here the exchange logic is hard coded and suposed to be the same for each exchange
        expect(result).toEqual(amount * (1 - exchange.tradingFees));
    });
});

describe('orderIsCompleted()', () => {
    test('order is completed', () => {
        exchange._request = jest
            .fn()
            .mockResolvedValueOnce(
                requestApiOutput.orderIsCompleted_isCompleted
            );

        return exchange.orderIsCompleted('btc/usd').then(result => {
            expect(result).toBe(true);
        });
    });
    test('order is not completed', () => {
        exchange._request = jest
            .fn()
            .mockResolvedValueOnce(
                requestApiOutput.orderIsCompleted_isNotCompleted
            );

        return exchange.orderIsCompleted('btc/usd').then(result => {
            expect(result).toBe(false);
        });
    });
});

describe('withdrawIsCompleted()', () => {
    test('withdraw is completed', () => {
        exchange._request = jest
            .fn()
            .mockResolvedValueOnce(
                requestApiOutput.withdrawIsCompleted_isCompleted
            );

        return exchange.withdrawIsCompleted('123456').then(result => {
            expect(result).toBe(true);
        });
    });
    test('withdraw is not completed', () => {
        exchange._request = jest
            .fn()
            .mockResolvedValueOnce(
                requestApiOutput.withdrawIsCompleted_isNotCompleted
            );

        return exchange.withdrawIsCompleted('123456').then(result => {
            expect(result).toBe(false);
        });
    });
    test('withdraw is not found', async () => {
        exchange._request = jest
            .fn()
            .mockResolvedValueOnce(
                requestApiOutput.withdrawIsCompleted_isNotFound
            );

        await expect(
            exchange.withdrawIsCompleted('111111')
        ).rejects.toThrowError();
    });
});
describe('depositIsCompleted()', () => {
    test.only('depostit is completed', () => {
        exchange._request = jest
            .fn()
            .mockResolvedValueOnce(
                requestApiOutput.depositIsCompleted_isCompleted
            );

        return exchange.depositIsCompleted(12, 'btc').then(result => {
            expect(result).toBe(true);
        });
    });
    test('deposit is not completed', () => {
        exchange._request = jest
            .fn()
            .mockResolvedValueOnce(
                requestApiOutput.depositIsNotCompleted_isCompleted
            );

        return exchange.depositIsCompleted(12, 'btc').then(result => {
            expect(result).toBe(false);
        });
    });
});
