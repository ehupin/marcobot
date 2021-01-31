import { getWithdrawFees } from '../../database/dbHandler';
jest.mock('../../database'); // used to later mock database functions in this file

const exchangeName = process.env.EXCHANGE_NAME;
let exchange = require(`../${exchangeName}`).default;
let requestApiOutput = require(`../__mock__/requestApiOutput/${exchangeName}`)
    .default;

function setRequestResult(describedFunction, testName) {
    const describedFunctionsTests = requestApiOutput[describedFunction];
    const testCalls = Object.keys(describedFunctionsTests);
    testCalls.sort();
    let mockedFunction = jest.fn();
    const testCallsNames = testCalls.filter(testCallName => {
        if (testCallName.startsWith(testName)) {
            const mockCallOutput = describedFunctionsTests[testCallName];
            mockedFunction = mockedFunction.mockResolvedValueOnce(
                mockCallOutput
            );
        }
    });
    exchange._request = mockedFunction;
}

test('getCurrencies', () => {
    setRequestResult('getCurrencies', 'get');
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

test.only('getMarkets', () => {
    setRequestResult('getMarkets', 'get');
    return exchange.getMarkets().then(markets => {
        expect(markets).toEqual(expect.any(Object));
        expect(markets).not.toEqual({});
        Object.keys(markets).map(marketLabel => {
            const market = markets[marketLabel];
            expect(market).toMatchObject({
                baseCurrency: expect.any(String),
                quoteCurrency: expect.any(String),
                minTradeAmount: expect.any(Number),
                maxTradeAmount: expect.any(Number),
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

test('getOrderBook', () => {
    setRequestResult('getOrderBook', 'get');

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

test('getWalletAmount', () => {
    setRequestResult('getWalletAmount', 'get');

    return exchange
        .getWalletAmount('btc')
        .then(orders => expect(orders).toEqual(expect.any(Number)));
});

test('getDepositAddress', () => {
    setRequestResult('getDepositAddress', 'get');

    // TODO: what happened if parameter is empty ?
    return exchange.getDepositAddress('btc').then(address => {
        expect(address.address).toEqual(expect.any(String));
        expect(address.address).not.toEqual('');
        expect(address.tag).toEqual(expect.any(String));
    });
});

test('applyWithdrawFees', () => {
    // mock db access made by applyWithdrawFees
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

test('applyTradingFees', () => {
    const amount = 100;
    expect(exchange.tradingFees).toEqual(expect.any(Number));
    return exchange.applyTradingFees(amount).then(result => {
        //TODO: here the exchange logic is hard coded and suposed to be the same for each exchange
        expect(result).toEqual(expect.any(Number));
        expect(result).toBeLessThan(amount);
    });
});

describe('orderIsCompleted', () => {
    test('order is completed', () => {
        setRequestResult('orderIsCompleted', 'isCompleted');

        return exchange.orderIsCompleted('btc/usd', '123456').then(result => {
            expect(result).toBe(true);
        });
    });
    test('order is not completed', () => {
        setRequestResult('orderIsCompleted', 'isNotCompleted');

        return exchange.orderIsCompleted('btc/usd', '123456').then(result => {
            expect(result).toBe(false);
        });
    });
});

describe('withdrawIsCompleted', () => {
    test('withdraw is completed', () => {
        setRequestResult('withdrawIsCompleted', 'isCompleted');
        return exchange.withdrawIsCompleted('123456').then(result => {
            expect(result).toBe(true);
        });
    });
    test('withdraw is not completed', () => {
        setRequestResult('withdrawIsCompleted', 'isNotCompleted');
        return exchange.withdrawIsCompleted('123456').then(result => {
            expect(result).toBe(false);
        });
    });
    test('withdraw is not found', async () => {
        setRequestResult('withdrawIsCompleted', 'isNotFound');
        return await expect(
            exchange.withdrawIsCompleted('111111')
        ).rejects.toThrowError();
    });
});
describe('depositIsCompleted', () => {
    test('deposit is completed', () => {
        setRequestResult('depositIsCompleted', 'isCompleted');
        return exchange.depositIsCompleted(12, 'btc').then(result => {
            expect(result).toBe(true);
        });
    });
    test('deposit is not completed', () => {
        setRequestResult('depositIsCompleted', 'isNotCompleted');
        return exchange.depositIsCompleted(12, 'btc').then(result => {
            expect(result).toBe(false);
        });
    });
});

describe.skip('placeOrder()', () => {
    test('order is placed', () => {
        setRequestResult('placeOrder', 'isPlaced');
        return exchange.depositIsCompleted(12, 'btc').then(result => {
            expect(result).toBe(true);
        });
    });
});

describe.skip('makeWithdrawal()', () => {
    test('withdrawal is made', () => {
        setRequestResult('makeWithdrawal', 'isMade');
        return exchange.depositIsCompleted(12, 'btc').then(result => {
            expect(result).toBe(true);
        });
    });
});
