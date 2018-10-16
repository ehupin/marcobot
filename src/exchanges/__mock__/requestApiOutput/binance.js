const requestApiOutput = {
    getMarkets: {
        get_0: {
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
        get_1: [
            {
                bidPrice: 100,
                askPrice: 120,
                volume: 10000,
                quoteVolume: 10000
            }
        ]
    },
    getCurrencies: {
        get: {
            assetDetail: {
                BTC: {
                    minWithdrawAmount: 71.6,
                    depositStatus: true,
                    withdrawFee: 35.8,
                    withdrawStatus: true
                }
            }
        }
    },
    getWalletAmount: { get: { balances: [{ asset: 'BTC', free: 0.5 }] } },
    getDepositAddress: {
        get: {
            address: '1Cx7NX9w5WomnPMTQJVjUYMVD9QUYp37De',
            addressTag: ''
        }
    },
    getOrderBook: {
        get: {
            lastUpdateId: 328749522,
            bids: [['0.03096500', '2.12400000'], ['0.03095600', '8.65600000']],
            asks: [['0.03236500', '4.32600000'], ['0.03245600', '9.33600000']]
        }
    },
    orderIsCompleted: {
        isCompleted: { status: 'FILLED' },
        isNotCompleted: { status: 'INPROCESS' }
    },
    withdrawIsCompleted: {
        isCompleted: {
            withdrawList: [{ id: '123456', status: 6 }]
        },
        isNotCompleted: {
            withdrawList: [{ id: '123456', status: 4 }]
        },
        isNotFound: {
            withdrawList: [{ id: '123456', status: 4 }]
        }
    },
    depositIsCompleted: {
        isCompleted: {
            depositList: [{ amount: 12, asset: 'BTC', status: 1 }]
        },
        isNotCompleted: {
            depositList: [{ amount: 12, asset: 'BTC', status: 0 }]
        }
    },
    placeOrder: {
        place: {
            symbol: 'GOBTC',
            orderId: 1403084,
            clientOrderId: 'sMDLOLiHiMUdLjVAlfR9K3',
            transactTime: 1539449008873,
            price: '0.00000000',
            origQty: '17030.00000000',
            executedQty: '17030.00000000',
            cummulativeQuoteQty: '0.08805455',
            status: 'FILLED',
            timeInForce: 'GTC',
            type: 'MARKET',
            side: 'BUY',
            fills: [
                {
                    price: '0.00000517',
                    qty: '7527.00000000',
                    commission: '7.52700000',
                    commissionAsset: 'GO',
                    tradeId: 221954
                },
                {
                    price: '0.00000517',
                    qty: '4830.00000000',
                    commission: '4.83000000',
                    commissionAsset: 'GO',
                    tradeId: 221955
                },
                {
                    price: '0.00000517',
                    qty: '3728.00000000',
                    commission: '3.72800000',
                    commissionAsset: 'GO',
                    tradeId: 221956
                },
                {
                    price: '0.00000518',
                    qty: '945.00000000',
                    commission: '0.94500000',
                    commissionAsset: 'GO',
                    tradeId: 221957
                }
            ]
        }
    },
    makeWithdrawal: {
        make: null
    }
};

export default requestApiOutput;
