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

const create_id_constraint = async () => {
  const allowedConstraintErrorCodes = [
    "Neo.ClientError.Schema.EquivalentSchemaRuleAlreadyExists",
    "Neo.ClientError.Schema.ConstraintAlreadyExists",
  ]

  // Nodes
  for await (const label of ["ApplicationForm", "ApplicationFormTemplate"]) {
    const session = driver.session()
    try {
      console.log(`[Neo4J] Creating ID constraint...`)
      await session.run(
        `CREATE CONSTRAINT FOR (a:${label}) REQUIRE a._id IS UNIQUE`
      )
      console.log(`[Neo4J] Created ID constraint`)
    } catch (error) {
      if (allowedConstraintErrorCodes.includes(error.code))
        console.log(`[Neo4j] Constraint or index already exists`)
      else throw error
    } finally {
      session.close()
    }
  }

  // Relationships
  for await (const relLabel of ["APPROVED", "REJECTED"]) {
    const session = driver.session()

    try {
      console.log(`[Neo4J] Creating ${relLabel} ID constraint...`)
      await session.run(
        `CREATE CONSTRAINT FOR ()<-[r:${relLabel}]-() REQUIRE r._id IS UNIQUE`
      )
      console.log(`[Neo4J] Created ${relLabel} ID constraint`)
    } catch (error) {
      if (allowedConstraintErrorCodes.includes(error.code))
        console.log(`[Neo4j] Constraint or index already exists`)
      else throw error
    } finally {
      session.close()
    }
  }
}

const init = async () => {
  if (await get_connection_status()) {
    connected = true

    console.log("[Neo4J] Initializing DB...")
    await set_ids()
    await create_id_constraint()
    console.log("[Neo4J] DB initialized")
  } else {
    setTimeout(init, 10000)
  }
}

exports.url = NEO4J_URL
exports.driver = driver
exports.get_connected = () => connected
exports.init = init
