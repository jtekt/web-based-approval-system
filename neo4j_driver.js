const neo4j = require('neo4j-driver')
const dotenv = require('dotenv')

dotenv.config()

module.exports= neo4j.driver(
  process.env.NEO4J_URL,
  neo4j.auth.basic(
    process.env.NEO4J_USERNAME,
    process.env.NEO4J_PASSWORD
  ),
  {
    disableLosslessIntegers: true,
  }
)
