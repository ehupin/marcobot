import fs from 'fs'
import {
    connectDb, clearDatabase, createDbNode, deleteDbNode,
} from './database.js'
import { getExchanges } from './exchanges.js'

const deepmerge = require('deepmerge')

async function setupDb() {
    const db = connectDb()
    await clearDatabase(db)

    // create collections
    await db.collection('markets').create()
    await db.collection('currencies').create()
    await db.collection('exchanges').create()
    await db.edgeCollection('marketHasExchange').create()
    await db.edgeCollection('marketHasCurrency').create()
    await db.edgeCollection('exchangeHasCurrency').create()

    // list all items to create
    let allItems = {}
    const exchanges = getExchanges()
    const exchangeItems = await Promise.all(exchanges.map(listExchangeRelatedNodesAndEdges))
    exchangeItems.map(x => (allItems = deepmerge(allItems, x)))

    // build them
    buildItems(db, allItems)

    return
    const data = JSON.stringify(allItems, null, 4)
    fs.writeFileSync('test.json', data)
}

async function listExchangeRelatedNodesAndEdges(exchange) {
    const nodes = {
        exchanges: {},
        currencies: {},
        markets: {},
    }
    const edges = {
        exchangeHasCurrency: [],
        marketHasExchange: [],
        marketHasCurrency: [],
    }

    // build exchange name
    nodes.exchanges[exchange.name] = {
        name: exchange.name,
        tradingFees: exchange.tradingFees,
    }

    // list currencies nodes and exchangeHasCurrency edges
    const currencies = await exchange.getCurrencies()
    for (const currencyName of Object.keys(currencies)) {
        // build currency node
        const currencyData = currencies[currencyName]
        nodes.currencies[currencyName] = { name: currencyName }

        // build exchangeHasCurrency edge
        const exchangeHasCurrencyEdge = Object.assign(currencyData, {
            _from: exchange.name,
            _to: currencyName,
        })
        edges.exchangeHasCurrency.push(exchangeHasCurrencyEdge)
    }

    // list markets nodes and marketHasExchange & marketHasCurrency edges
    const markets = await exchange.getMarkets()
    for (const marketName of Object.keys(markets)) {
        const marketData = markets[marketName]
        const marketLabel = `${exchange.name} - ${marketName}`

        // build marketHasCurrency edges
        edges.marketHasCurrency.push({
            type: 'base',
            _from: marketLabel,
            _to: marketData.baseCurrency,
        })
        edges.marketHasCurrency.push({
            type: 'quote',
            _from: marketLabel,
            _to: marketData.quoteCurrency,
        })

        // build marketHasExchange edges
        edges.marketHasExchange.push({
            _from: marketLabel,
            _to: exchange.name,
        })

        // build market node
        delete marketData.baseCurrency
        delete marketData.quoteCurrency
        nodes.markets[marketLabel] = Object.assign(marketData, { label: marketLabel })
    }
    return { nodes, edges }
}

async function buildItems(db, items) {
    const nodeIds = {}
    for (const nodeType of Object.keys(items.nodes)) {
        for (const nodeName of Object.keys(items.nodes[nodeType])) {
            const nodeData = items.nodes[nodeType][nodeName]
            const node = await createDbNode(db, nodeType, nodeData)

            if (!Object.keys(nodeIds).includes(nodeType)) {
                nodeIds[nodeType] = {}
            }

            nodeIds[nodeType][nodeName] = node._id
        }
    }

    const toDelete = {
        markets: [],
    }
    for (const edgeType of Object.keys(items.edges)) {
        for (const edge of items.edges[edgeType]) {
            const initEdge = Object.assign({}, edge)

            if (edgeType === 'exchangeHasCurrency') {
                (edge._from = nodeIds.exchanges[edge._from]),
                (edge._to = nodeIds.currencies[edge._to])
            } else if (edgeType === 'marketHasExchange') {
                (edge._from = nodeIds.markets[edge._from]),
                (edge._to = nodeIds.exchanges[edge._to])
            } else if (edgeType === 'marketHasCurrency') {
                if (!nodeIds.currencies[edge._to]) {
                    toDelete.markets.push(edge._from)
                    continue
                }

                (edge._from = nodeIds.markets[edge._from]),
                (edge._to = nodeIds.currencies[edge._to])
            }

            // console.log(edgeType, edge)
            await createDbNode(db, edgeType, edge)
        }
    }

    for (const marketName of toDelete.markets) {
        const marketId = nodeIds.markets[marketName]
        console.log(marketId)
        await deleteDbNode(db, marketId)
    }
}

setupDb()
