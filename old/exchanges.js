export function Exchange(){
    
}


export const exchanges_fees = {
    bittrex:{
        tradingFees: 0.025,
        withdrawalFees: {
            BTC:0.0005,
            ETH:0.006,
            XRP:1,
            "BCC/BCH":0.001,
            XLM:0.01,
            LTC:0.01,
            ADA:0.2,
            TRX:0.003,
            NEO:0.025,
            ETC:0.01,
            XEM:4,
            OMG:0.35,
            LSK:0.1,
            ZRX:1,
        }
    },
    bitstamp:{
        tradingFees: 0.025,
        withdrawalFees: {
            BTC: 0,
            ETH: 0,
            XRP: 0,
            "BCC/BCH": 0,
            LTC: 0,
        }
    },
    binance: {
        tradingFees: 0.1,
        withdrawalFees: {
            BTC: 0.0005,
            ETH: 0.01,
            XRP: 0.25,
            "BCC/BCH": 0.001,
            EOS: 0.1,
            XLM: 0.01,
            LTC: 0.001,
            ADA: 1,
            TRX: 1,
            NEO: 0,
            ETC: 0.01,
            BNB: 0.15,
            XEM: 4,
            VET: 100,
            OMG: 0.41,
            LSK: 0.1,
            ZRX: 2.4,
            NANO: 0.01,
        },
        minimunWithdrawal: {
            BTC: 0.002,
            ETH: 0.02,
            XRP: 22,
            "BCC/BCH": 0.002,
            EOS: 0.2,
            XLM: 21,
            LTC: 0.002,
            ADA: 4,
            TRX: 10,
            NEO: 1,
            ETC: 0.02,
            BNB: 0.3,
            XEM: 8,
            VET: 200,
            OMG: 0.82,
            LSK: 0.2,
            ZRX: 4.8,
            NANO: 1
        }
    }
}

	