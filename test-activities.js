import fs from 'fs'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const HEALTH_BASE = 'https://health.googleapis.com/v4/users/me'

async function getAccessToken() {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  return data.access_token
}

async function test() {
  const token = await getAccessToken()
  const dateStr = '2026-06-18' // A recent day
  
  // Try activity-segment
  try {
    const res = await fetch(`${HEALTH_BASE}/dataTypes/activity-segment/dataPoints?filter=activity_segment.start_time>="${dateStr}T00:00:00Z"`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    console.log("Activity Segment status:", res.status)
    const json = await res.json()
    console.log(JSON.stringify(json).slice(0, 500))
  } catch(e) {
    console.log("Activity Segment Error")
  }
}

test()
