const neo4j = require('neo4j-driver')
const dotenv = require('dotenv')

dotenv.config()

const {
  NEO4J_URL = 'bolt://neo4j:7687',
  NEO4J_USERNAME,
  NEO4J_PASSWORD,
} = process.env

const auth = neo4j.auth.basic( NEO4J_USERNAME, NEO4J_PASSWORD )
const options = { disableLosslessIntegers: true }
const driver = neo4j.driver( NEO4J_URL, auth, options )

let connected = false

const init = async () => {
  console.log('[Neo4J] Initializing DB')

  const id_setting_query = `
  MATCH (n:ApplicationForm)
  WHERE NOT EXISTS(n._id)
  SET n._id = toString(id(n))
  RETURN COUNT(n) as count
  `

  const session = driver.session()

  try {
    const {records} = await session.run(id_setting_query)
    const count = records[0].get('count')
    console.log(`[Neo4J] ID of ${count} nodes have been set`)
    connected = true
  }
  catch (e) {
    console.log(e)
    console.log(`[Neo4J] init failed, retrying in 10s`)
    setTimeout(init,10000)
  }
  finally {
    session.close()
  }

}

exports.url = NEO4J_URL
exports.driver = driver
exports.get_connected = () => connected
exports.init = init
