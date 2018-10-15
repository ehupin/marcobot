import { bitstamp } from '../exchanges/bitstamp.js'

async function run_test() {
    for (const coin of ['eth', 'btc', 'bch', 'ltc', 'xrp']) {
        const r = await bitstamp.getDepositAdress(coin)
        console.log(coin, r)
    }
}

run_test()
