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

exports.driver = neo4j.driver( NEO4J_URL, auth, options )
exports.url = NEO4J_URL
