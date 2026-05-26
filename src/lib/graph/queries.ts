export const GET_DELEGATIONS = `
  query GetDelegations($first: Int!) {
    delegations(
      first: $first
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      hash
      delegator
      delegatee
      hopCount
      status
      createdAt
    }
  }
`

export const GET_AGENTS = `
  query GetAgents($first: Int!) {
    agents(first: $first, orderBy: registeredAt, orderDirection: desc) {
      id
      agentId
      name
      endpoint
      active
      totalRuns
      successfulRuns
      totalSpent
      registeredAt
    }
  }
`

export const GET_TREASURY_SUMMARY = `
  query GetTreasurySummary($paymentsFirst: Int!) {
    treasuryState(id: "treasury") {
      balance
      totalFunded
      totalSpent
      lastUpdatedAt
    }
    treasuryEvents(
      first: $paymentsFirst
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      eventType
      amount
      actor
      agentId
      txHash
      timestamp
      userShare
      refillShare
      platformShare
    }
  }
`

export const GET_DAILY_PAYMENTS = `
  query GetDailyPayments($since: BigInt!) {
    treasuryEvents(
      where: { eventType: PAYMENT, timestamp_gte: $since }
      first: 1000
      orderBy: timestamp
      orderDirection: asc
    ) {
      amount
      timestamp
    }
  }
`

export const GET_ACTIVITY_FEED = `
  query GetActivityFeed($first: Int!) {
    activityEvents(
      first: $first
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      eventType
      actor
      agentId
      delegationHash
      description
      amount
      txHash
      timestamp
    }
  }
`
