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
