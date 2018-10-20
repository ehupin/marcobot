const requestApiOutput = {
    getCurrencies: {
        get: {
            result: [
                {
                    Currency: 'BTC',
                    CurrencyLong: 'Bitcoin',
                    MinConfirmation: 2,
                    TxFee: 0.0005,
                    IsActive: true,
                    IsRestricted: false,
                    CoinType: 'BITCOIN',
                    BaseAddress: '1N52wHoVR79PMDishab2XmRHsbekCdGquK',
                    Notice: null
                }
            ]
        }
    },
    getMarkets: {
        get: {
            result: [
                {
                    Market: {
                        MarketCurrency: 'FCT',
                        BaseCurrency: 'BTC',
                        MarketCurrencyLong: 'Factom',
                        BaseCurrencyLong: 'Bitcoin',
                        MinTradeSize: 0.07386856,
                        MarketName: 'BTC-FCT',
                        IsActive: true,
                        IsRestricted: false,
                        Created: '2016-01-09T03:47:07.803',
                        Notice: null,
                        IsSponsored: null,
                        LogoUrl:
                            'https://bittrexblobstorage.blob.core.windows.net/public/2478893a-5e5d-469e-81bd-e351195858d9.png'
                    },
                    Summary: {
                        MarketName: 'BTC-FCT',
                        High: 0.00067,
                        Low: 0.000628,
                        Volume: 6886.69876278,
                        Last: 0.00063354,
                        BaseVolume: 4.41590732,
                        TimeStamp: '2018-10-16T21:13:04.837',
                        Bid: 0.00063355,
                        Ask: 0.00064008,
                        OpenBuyOrders: 88,
                        OpenSellOrders: 1168,
                        PrevDay: 0.00063708,
                        Created: '2016-01-09T03:47:07.803'
                    },
                    IsVerified: false
                }
            ]
        }
    },
    getWalletAmount: {
        get: {
            result: {
                Currency: 'BTC',
                Balance: 0,
                Available: 0,
                Pending: 0,
                CryptoAddress: '148NCF4RqFSYWf3R16S9vHUqcZbP15bfnw'
            }
        }
    },
    getDepositAddress: {
        get: {
            result: {
                Currency: 'BTC',
                Address: '148NCF4RqFSYWf3R16S9vHUqcZbP15bfnw'
            }
        }
    },
    getOrderBook: {
        get: {
            result: [
                { Quantity: 3.42130352, Rate: 0.03175 },
                { Quantity: 42.299, Rate: 0.03179999 }
            ]
        }
    },
    orderIsCompleted: {
        isCompleted: {
            result: [
                {
                    OrderUuid: '123456',
                    QuantityRemaining: 0
                }
            ]
        },
        isNotCompleted: {
            result: [
                {
                    OrderUuid: '123456',
                    QuantityRemaining: 100000.0
                }
            ]
        }
    },
    withdrawIsCompleted: {
        isCompleted: {
            result: [
                {
                    PaymentUuid: '123456',
                    Currency: 'BTC',
                    Authorized: true,
                    PendingPayment: false
                }
            ]
        },
        isNotCompleted: {
            result: [
                {
                    PaymentUuid: '123456',
                    Currency: 'BTC',
                    Authorized: false,
                    PendingPayment: true
                }
            ]
        },
        isNotFound: {
            result: [
                {
                    PaymentUuid: '123456',
                    Currency: 'BTC',
                    Authorized: false,
                    PendingPayment: true
                }
            ]
        }
    },
    depositIsCompleted: {
        isCompleted: {},
        isNotCompleted: {}
    },
    placeOrder: {
        place: {}
    },
    makeWithdrawal: {
        make: null
    }
};

export default requestApiOutput;
