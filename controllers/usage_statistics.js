const createHttpError = require("http-errors")
const { driver } = require("../db.js")

exports.get_groups_usage = async (req, res, next) => {
  const session = driver.session()

  const { type, start_date, end_date } = req.query

  if (!type) throw createHttpError(400, "Group type not defined")

  try {
    const today = new Date()
    const month = today.getMonth() + 1
    const query = `
        MATCH (application:ApplicationForm)-[:SUBMITTED_BY]->(user:User)-[:BELONGS_TO]->(group:Group {type: $type})
        WHERE application.creation_date >= date($start_date)
        AND application.creation_date <= date($end_date)
        RETURN group.name as group, COUNT(application) AS application_count, COUNT(DISTINCT user) AS user_count
      `

    const params = {
      type,
      start_date: start_date ? start_date : "2022-06-15",
      end_date: end_date
        ? end_date
        : `${today.getFullYear()}-${month}-${today.getDate()}`,
    }

    const { records } = await session.run(query, params)
    if (!records.length) throw createError(404, `not found`)

    res.send(
      records.map((record) => {
        return {
          group: record.get("group"),
          application_count: record.get("application_count"),
          user_count: record.get("user_count"),
        }
      })
    )
  } catch (error) {
    next(error)
  } finally {
    session.close()
  }
}

exports.get_types_usage = async (req, res, next) => {
  const session = driver.session()
  try {
    const { start_date, end_date } = req.query

    const today = new Date()
    const month = today.getMonth() + 1
    const query = `
        MATCH (application:ApplicationForm)
        WHERE application.creation_date >= date($start_date)
            AND application.creation_date <= date($end_date)
        WITH COLLECT(DISTINCT application.type) as types
        UNWIND types AS type
        MATCH (application:ApplicationForm {type: type})
        WITH COUNT(application) AS application_count, type
        RETURN { type: type, application_count: application_count} as types
      `

    const params = {
      start_date: start_date ? start_date : "2022-06-15",
      end_date: end_date
        ? end_date
        : `${today.getFullYear()}-${month}-${today.getDate()}`,
    }

    const { records } = await session.run(query, params)
    if (!records.length) throw createError(404, `not found`)

    res.send(records.map((record) => record.get("types")))
  } catch (error) {
    next(error)
  } finally {
    session.close()
  }
}
