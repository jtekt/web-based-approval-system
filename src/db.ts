import neo4j from 'neo4j-driver';
import { env } from './env';

const auth = neo4j.auth.basic(env.NEO4J_USERNAME, env.NEO4J_PASSWORD);
const options = { disableLosslessIntegers: true };
export const driver = neo4j.driver(env.NEO4J_URL, auth, options);

let connected = false;

const get_connection_status = async () => {
  const session = driver.session();
  try {
    console.log(`[Neo4J] Testing connection...`);
    await session.run('RETURN 1');
    console.log(`[Neo4J] Connection successful`);
    return true;
  } catch (e) {
    console.log(`[Neo4J] Connection failed`);
    return false;
  } finally {
    await session.close();
  }
};

const set_ids = async () => {
  const id_setting_query = `
    MATCH (n:ApplicationForm)
    WHERE n._id IS NULL
    SET n._id = toString(id(n))
    RETURN COUNT(n) as count
    `;

  const session = driver.session();

  try {
    const { records } = await session.run(id_setting_query);
    const count = records[0].get('count');
    console.log(`[Neo4J] Formatted new ID for ${count} nodes`);
  } catch (e) {
    throw e;
  } finally {
    await session.close();
  }
};

const create_id_constraint = async () => {
  const session = driver.session();

  try {
    for (const label of ['ApplicationForm', 'ApplicationFormTemplate']) {
      console.log(`[Neo4J] Creating ${label} ID constraint...`);

      await session.run(
        `CREATE CONSTRAINT IF NOT EXISTS FOR (a:${label}) REQUIRE a._id IS UNIQUE`
      );

      console.log(`[Neo4J] Created ${label} ID constraint`);
    }

    for (const relLabel of ['APPROVED', 'REJECTED']) {
      console.log(`[Neo4J] Creating ${relLabel} ID constraint...`);

      await session.run(
        `CREATE CONSTRAINT IF NOT EXISTS FOR ()<-[r:${relLabel}]-() REQUIRE r._id IS UNIQUE`
      );

      console.log(`[Neo4J] Created ${relLabel} ID constraint`);
    }
  } finally {
    await session.close();
  }
};

export const init = async () => {
  if (await get_connection_status()) {
    connected = true;

    console.log('[Neo4J] Initializing DB...');
    await set_ids();
    await create_id_constraint();
    console.log('[Neo4J] DB initialized');
  } else {
    setTimeout(init, 10000);
  }
};

export const get_connected = () => connected;
