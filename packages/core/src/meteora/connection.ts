import { Connection } from '@solana/web3.js'

export function createRpcConnection(): Connection {
  const key = process.env.HELIUS_API_KEY
  if (!key) {
    throw new Error('HELIUS_API_KEY is required for the worker / core RPC connection')
  }
  const url = process.env.SOLANA_RPC_URL ?? `https://mainnet.helius-rpc.com/?api-key=${key}`
  const ws = process.env.SOLANA_WS_URL ?? `wss://mainnet.helius-rpc.com/?api-key=${key}`
  return new Connection(url, {
    commitment: 'confirmed',
    wsEndpoint: ws,
  })
}
