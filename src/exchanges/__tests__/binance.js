import exchange from '../binance';

const mockedApiResult = {
    '/api/v1/exchangeInfo': {
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
    '/api/v1/ticker/24hr': [
        {
            bidPrice: 100,
            askPrice: 120,
            volume: 10000,
            quoteVolume: 10000
        }
    ],
    '/wapi/v3/assetDetail.html': {
        assetDetail: {
            BTC: {
                minWithdrawAmount: 71.6,
                depositStatus: true,
                withdrawFee: 35.8,
                withdrawStatus: true
            }
        }
    },
    '/api/v1/depth': {
        lastUpdateId: 328749522,
        bids: [['0.03096500', '2.12400000'], ['0.03095600', '8.65600000']],
        asks: [['0.03236500', '4.32600000'], ['0.03245600', '9.33600000']]
    },
    '/api/v3/account': { balances: [{ asset: 'BTC', free: 0.5 }] },
    '/wapi/v3/depositAddress.html': {
        address: '1Cx7NX9w5WomnPMTQJVjUYMVD9QUYp37De',
        addressTag: ''
    }
};

async function mockedRequest(type, url) {
    return mockedApiResult[url];
}

test('Get markets', () => {
    exchange.getMarkets(mockedRequest).then(markets => {
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
    exchange.getCurrencies(mockedRequest).then(currencies => {
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
    return exchange
        .getOrderBook('btc/usd', 'ask', mockedRequest)
        .then(orders => {
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
    return exchange
        .getWalletAmount('btc', mockedRequest)
        .then(orders => expect(orders).toEqual(expect.any(Number)));
});

test.only('Get deposit address', () => {
    // TODO: what happened if parameter is empty ?
    return exchange.getDepositAddress('btc', mockedRequest).then(address => {
        expect(address.address).toEqual(expect.any(String));
        expect(address.address).not.toEqual('');
        expect(address.tag).toEqual(expect.any(String));
    });
});
