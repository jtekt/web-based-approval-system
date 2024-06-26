const neo4j = require("neo4j-driver")

const {
  NEO4J_URL = "bolt://neo4j:7687",
  NEO4J_USERNAME,
  NEO4J_PASSWORD,
} = process.env

const auth = neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
const options = { disableLosslessIntegers: true }
const driver = neo4j.driver(NEO4J_URL, auth, options)

let connected = false

const get_connection_status = async () => {
  const session = driver.session()
  try {
    console.log(`[Neo4J] Testing connection...`)
    await session.run("RETURN 1")
    console.log(`[Neo4J] Connection successful`)
    return true
  } catch (e) {
    console.log(`[Neo4J] Connection failed`)
    return false
  } finally {
    session.close()
  }
}

const set_ids = async () => {
  // TODO: also deal with relationships?

  const id_setting_query = `
    MATCH (n:ApplicationForm)
    WHERE n._id IS NULL
    SET n._id = toString(id(n))
    RETURN COUNT(n) as count
    `

  const session = driver.session()

  try {
    const { records } = await session.run(id_setting_query)
    const count = records[0].get("count")
    console.log(`[Neo4J] Formatted new ID for ${count} nodes`)
  } catch (e) {
    throw e
  } finally {
    session.close()
  }
}

const init = async () => {
  if (await get_connection_status()) {
    connected = true

    try {
      console.log("[Neo4J] Initializing DB")
      await set_ids()
    } catch (error) {
      console.log(error)
    }
  } else {
    setTimeout(init, 10000)
  }
}

exports.url = NEO4J_URL
exports.driver = driver
exports.get_connected = () => connected
exports.init = init
