


exports.non_deleted_applications = `
WHERE NOT EXISTS(application.deleted)
`
