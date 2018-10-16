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
        get: {}
    },
    getDepositAddress: {
        get: {}
    },
    getOrderBook: {
        get: {}
    },
    orderIsCompleted: {
        isCompleted: {},
        isNotCompleted: {}
    },
    withdrawIsCompleted: {
        isCompleted: {},
        isNotCompleted: {},
        isNotFound: {}
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
