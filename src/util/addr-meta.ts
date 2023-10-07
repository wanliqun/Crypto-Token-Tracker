import axios from 'axios'
import {sleep} from 'modern-async'
import { logger } from '../config/config'
//import {HttpsProxyAgent} from 'https-proxy-agent'
//import {logger} from '../config/config'

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

export async function getAddrInfoFromOkLink(
  token: string, addr: string, chain: string, maxTries: number = 3) {
  for (let i = 0; i < maxTries; i++) {
    try {
      const info = await _getAddrInfoFromOkLink(token, addr, chain)
      return info
    } catch(err) {
      if (i !== maxTries -1) {
        await sleep(1000)
        continue
      }

      logger.error("Failed to get addr info from OKLink", {token, addr, chain, err})
      throw(err)
    }
  }
}

async function _getAddrInfoFromOkLink(token: string, addr: string, chain: string) {
  const result = await axios.get('https://www.oklink.com/api/tracker/c/v1/address/info/v1', {
    params: {
      address: addr,
      chain: chain,
      tokenContractAddress: token,
    },
    headers: {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'sec-ch-ua': '"Not.A/Brand";v="8", "Chromium";v="114", "Google Chrome";v="114"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
      cookie: '_okcoin_legal_currency=CNY; devId=3022f335-2a4f-4b90-8ea8-a0d41efcbe61; first_ref=https%3A%2F%2Fwww.google.com%2F; Hm_lvt_5244adb4ce18f1d626ffc94627dd9fd7=1686712651; u_pid=D6D6lm9rBGLuAy5jB70; x-lid=-2019N; aliyungf_tc=e62c46d7ad0fdbda9ff4de3e52bea0c95c74e6b304f7111de2a4b1adf1a07b32; okg.currentMedia=xl; locale=zh_CN; token=eyJhbGciOiJIUzUxMiJ9.eyJqdGkiOiJvazExMDE2ODc2NzU5MzIxMTMyQzMzREU0QzUyQ0E5REU2MWFtWW8iLCJ1aWQiOiJaYWo5UkRmM01NT1haMEFJTXBVV2pnPT0iLCJzdGEiOjAsIm1pZCI6IlphajlSRGYzTU1PWFowQUlNcFVXamc9PSIsImlhdCI6MTY4NzY3NTkzMiwiZXhwIjoxNjg4MjgwNzMyLCJiaWQiOjAsImRvbSI6Ind3dy5va2xpbmsuY29tIiwiZWlkIjoxLCJpc3MiOiJva2NvaW4iLCJzdWIiOiI0RURFNjU4MjgyNEZFQjkwNDJBNzJFODQ0QUU3NzEyRiJ9.X8f4DVCWiz1ER6kCS6z1DUXYheGfVJQZyu8c42soEWqy_Fd6XPO2SvDWh75TpfuSR_8eRwbtBM86GK5ZjohEFQ; isLogin=1; ftID=52105232235491.110eb6e3a9c4ff7ca836f61e4ef891d738092.1010L8o0.A7B85EF186A1E5A2; Hm_lpvt_5244adb4ce18f1d626ffc94627dd9fd7=1687845332; _monitor_extras={"deviceId":"vlWSpjjVwYCjIdprNfoJaX","eventId":412,"sequenceNumber":412}; __cf_bm=W.FHAjw_yeBw4XlI0golZRrPSaN4wiR2PK7MsBnw0Xs-1687851319-0-AZDNitdFv11kkBmKRKvC8UH1VK7EtjLGiDiUFkhG6yEQjDn4k3OneVJCeE6FtDvNvuwrTgIovvL2mE7hsGokm88=',
      Referer: 'https://www.oklink.com/cn/chaintelligence/compliancetools',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    },
    // proxy: false,
    // httpsAgent: new HttpsProxyAgent(`http://127.0.0.1:1087`)
  })

  if (!(result.data?.code == 0)) {
    throw new Error(result.data?.msg)
  }

  const tag = result.data?.data?.addressTag?.tag
  const isContract = result.data?.data?.contract

  return {tag, isContract}
}
