const application = {
  identity: Number,
  properties: Object,
  applicant: {
    identity: Number,
    properties: Object,
  },
  recipients: [
    {
      identity: Number,
      properties: Object,
      // approval or refusal
      decision: {
        identity: Number,
        properties: Object,
      }
    },
    // other ecipients
  ]
}
