import mysql from 'mysql2'
import {logger} from '../config/config'
import {getAddrDetail, getAddrHealthyScore} from './oklink-client'

const cexTags = [
  'MaskEX',
  'Binance',
  'Kucoin',
  'Huobi',
  'Coinbase',
  'Kraken',
  'OKX',
  'OKEX',
  'Bitstamp',
  'Bitfinex',
  'Hotbit',
  'Gemini',
  'Yobit',
  'Bybit',
  'Gate',
  'MXC',
  'MEXC',
  'Bitget',
  'FTX',
  'CoinEX',
  'Poloniex',
  'Bitex',
  'ZB',
  'Bitmax',
  'Crypto.com',
  'HitBTC',
  'Btse',
  'Cointiger',
  'Pionex',
  'BingX',
  'KickEX',
  'CITEX',
  'BKEX',
  'BitoEX',
  'Bitbee',
  'Bibox',
  'Nexo',
  'Bittrex',
  'CEX.io',
]

export function identityCex(addrTag: string): string | undefined {
  if (!addrTag) {
    return
  }

  if (["okx", "okex"].includes(addrTag.toLowerCase())) {
    return "OKX"
  }

  if (["mxc", "mexc"].includes(addrTag.toLowerCase())) {
    return "MXC"
  }

  for (const cex of cexTags) {
    if (addrTag.toLowerCase().includes(cex.toLowerCase())) {
      return cex
    }
  }
}

export async function getAddrTagFromOkLinkAddrStore(dbpool: mysql.Pool, addr: string, chain: string) {
  const tableName = `oklink_${chain}_addresses`

  try {
    const [rows] = await dbpool.promise().query(
      `SELECT * FROM ${tableName} WHERE addr = ?`, [addr],
    )

    const values = rows as mysql.RowDataPacket[]
    return values[0]?.entity_tag
  } catch (error) {
    logger.error('Failed to get address tag from oklink address store', {addr, chain})
  }
}
