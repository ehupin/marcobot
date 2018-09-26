// import {getNodetypes} from '../common/utils.js'
import { Database, aql } from "arangojs";
import {listPairs} from './pairs.js'
import {exchanges_fees} from './exchanges.js'



export async function clearDatabase() {
    for (let collection of await db.listCollections()) {
        if (!collection.isSystem) {
            db.collection(collection.name).drop();
        }
    }
}

async function createDatabase(dbName){
    // create zoa database
    const databases = await db.listDatabases()
    if (!databases.includes(dbName)){
        db.createDatabase(dbName)
    }
}

async function initDb(){
    const collections = await db.listCollections()
    const collectionsName = collections.map(collection => collection.name);
    
    for (let collectionName of ['exchange', 'currency', 'market']){
        if (!collectionsName.includes(collectionName)){
            let collection = db.collection(collectionName);
            // console.log(collection)
            collection.create()
        }
    }
    
    for (let collectionName of ['market_has_exchange','market_has_baseCurrency', 'market_has_quoteCurrency', 'exchange_has_currency']){
        if (!collectionsName.includes(collectionName)){
            let collection = db.edgeCollection(collectionName);
            // console.log(collection)
            collection.create()
        }
    }
    
    
    
    // db.edgeCollection(collectionName, true)
    
}
    
async function updateCollections(){
    const collections = await db.listCollections()
    const collectionsName = collections.map(collection => collection.name);
    
    // for each nodetype, create a collection if it doesn't exist
    getNodetypes().forEach(async function (nodetype) {
        
        if (!collectionsName.includes(nodetype.name)){
            let collection = db.collection(nodetype.name);
            // TODO: prevent creation of collectionns starting with "_", check it seems to be prevented by default
            await collection.create()
        }
    })
}

export async function createDbNode (nodetypeName, nodeData) {
    
    const cursor = await db.query(aql`
        INSERT 
        ${nodeData}
        INTO ${db.collection(nodetypeName)}
        RETURN NEW
    `);
    let node = await cursor.next()
    // node._nodetypeName = nodetypeName
    return node
}


export async function connectDbNodes (collectionName, sourceNode, destNode) {
    
    
    // UPSERT { mail: 'email@ndd.com' }
    // INSERT { }
    // UPDATE { mail: 'email@ndd.com', name: 'fab1', arrayinfo: [{stringheader:'value15258'}]}
    // IN tuto
    // RETURN { OLD: OLD, NEW: NEW }

    // console
    console.log('\n=====================\n')
    console.log('>>', destNode._id)
    
    const edgeDescription = {
        _from : sourceNode._id,
        _to: destNode._id
    }
    
    const cursor = await db.query(aql`INSERT ${edgeDescription} IN ${db.edgeCollection(collectionName)}`);
    // let node = cursor.next()
    // return node
}

function buildDb(){
    initDb().then(()=>{
        listPairs().then(async (pairs) => {
            let exchanges = {}
            let currencies = {}
            let markets = []
            for(let pair of pairs){
                console.log('\n====================\n')
                if (!Object.keys(exchanges).includes(pair.exchange)){
                    exchanges[pair.exchange] = await createDbNode('exchange', {label: pair.exchange})
                }
                
                if (!Object.keys(currencies).includes(pair.baseCurrency)){
                    currencies[pair.baseCurrency] = await createDbNode('currency', {label: pair.baseCurrency})
                }
                
                if (!Object.keys(currencies).includes(pair.quoteCurrency)){
                    currencies[pair.quoteCurrency] = await createDbNode('currency', {label: pair.quoteCurrency})
                }
                

                const market = await createDbNode('market', {label: `${pair.baseCurrency}/${pair.quoteCurrency} - ${pair.exchange}`})
             
                connectDbNodes('market_has_exchange', market, exchanges[pair.exchange])
                
                connectDbNodes('market_has_baseCurrency', market, currencies[pair.baseCurrency])
                connectDbNodes('market_has_quoteCurrency', market, currencies[pair.quoteCurrency])
            }
            
            for (let exchange )
        })
    })
}

const db = new Database('http://0.0.0.0:8529');
db.useBasicAuth("root", "arangodb");
createDatabase("cryptoBot")
db.useDatabase('cryptoBot'); 



clearDatabase().then(()=>{
    buildDb()    
})




// clearDatabase()
// process.exit()



