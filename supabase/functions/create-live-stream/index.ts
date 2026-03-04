// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const MUX_TOKEN_ID = Deno.env.get('MUX_TOKEN_ID')
const MUX_TOKEN_SECRET = Deno.env.get('MUX_TOKEN_SECRET')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type'
      } 
    })
  }

  try {
    if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
      throw new Error('Mux credentials not configured in Supabase Secrets')
    }

    const response = await fetch('https://api.mux.com/video/v1/live-streams', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`)}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        playback_policy: ['public'],
        new_asset_settings: { playback_policy: ['public'] }
      })
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error?.message || 'Mux API error')

    const stream = data.data
    return new Response(
      JSON.stringify({
        stream_key: stream.stream_key,
        playback_id: stream.playback_ids[0].id
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
})
