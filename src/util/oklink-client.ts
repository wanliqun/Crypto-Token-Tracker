import axios from 'axios'
import {sleep} from 'modern-async'
import { logger } from '../config/config'
//import {HttpsProxyAgent} from 'https-proxy-agent'
//import {logger} from '../config/config'

const trackerAddrInfoUrl = 'https://www.oklink.com/api/tracker/c/v1/address/info/v1'
const trackerAddrDetailUrl = 'https://www.oklink.com/api/tracker/c/v1/r1/address/detail'
const trackerHealthyScoreUrl = 'https://www.oklink.com/api/tracker/c/v1/r1/healthy/scoreV3'
const trackerAddrMoneyFlowUrl = 'https://www.oklink.com/api/tracker/c/v1/address/moneyFlow/v1'

export async function getAddrAddrMoneyFlows(token: string, addr: string, chain: string, reqParams: any) {
    const params = {
        ...reqParams,
        address: addr,
        chain: chain,
        tokenContractAddress: token,
    }
    return await makeComplianceToolsRequest(trackerAddrMoneyFlowUrl, params)
}

export async function getAddrOverall(token: string, addr: string, chain: string) {
    const detail = await getAddrDetail(token, addr, chain)
    const healthyInfo = await getAddrHealthyScore(addr, chain)
  
    return {
      token: token,
      address: addr,
      tag: detail?.tag,
      tagInfo: detail?.tagInfo,
      isContract: detail?.isContract,
      statistics: detail?.statistics,
      healthyScore: healthyInfo?.score,
      healthyInfo: healthyInfo?.info,
    }
}

export async function getAddrHealthyScore(addr: string, chain: string) {
    const info = await makeComplianceToolsRequest(trackerHealthyScoreUrl, {
        address: addr, chain: chain,
    })

    return { info, score: info?.score, }
}

export async function getAddrDetail(token: string, addr: string, chain: string) {
    const info = await makeComplianceToolsRequest(trackerAddrDetailUrl, {
        address: addr,
        chain: chain,
        tokenContractAddress: token,
    })

    return {
        statistics: info,
        tag: info?.addressTag?.tag,
        isContract: info?.contract,
        tagInfo: info?.tagInfoVo,
    }
}

export async function getAddrInfo(token: string, addr: string, chain: string) {
    const info = await makeComplianceToolsRequest(trackerAddrInfoUrl, {
        address: addr,
        chain: chain,
        tokenContractAddress: token,
    })

    return {
        tag: info?.addressTag?.tag,
        isContract: info?.contract
    }
}

async function makeComplianceToolsRequest(url: string, params: any) {
    const result = await axios.get(url, {
        params: params,
        headers: {
        'authority': 'www.oklink.com',
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'sec-ch-ua': '"Not.A/Brand";v="8", "Chromium";v="114", "Google Chrome";v="114"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        //'upgrade-insecure-requests': '1',
        'cookie': '_okcoin_legal_currency=CNY; devId=3022f335-2a4f-4b90-8ea8-a0d41efcbe61; first_ref=https%3A%2F%2Fwww.google.com%2F; Hm_lvt_5244adb4ce18f1d626ffc94627dd9fd7=1686712651; u_pid=D6D6lm9rBGLuAy5jB70; x-lid=-2019N; aliyungf_tc=e62c46d7ad0fdbda9ff4de3e52bea0c95c74e6b304f7111de2a4b1adf1a07b32; okg.currentMedia=xl; locale=zh_CN; token=eyJhbGciOiJIUzUxMiJ9.eyJqdGkiOiJvazExMDE2ODc2NzU5MzIxMTMyQzMzREU0QzUyQ0E5REU2MWFtWW8iLCJ1aWQiOiJaYWo5UkRmM01NT1haMEFJTXBVV2pnPT0iLCJzdGEiOjAsIm1pZCI6IlphajlSRGYzTU1PWFowQUlNcFVXamc9PSIsImlhdCI6MTY4NzY3NTkzMiwiZXhwIjoxNjg4MjgwNzMyLCJiaWQiOjAsImRvbSI6Ind3dy5va2xpbmsuY29tIiwiZWlkIjoxLCJpc3MiOiJva2NvaW4iLCJzdWIiOiI0RURFNjU4MjgyNEZFQjkwNDJBNzJFODQ0QUU3NzEyRiJ9.X8f4DVCWiz1ER6kCS6z1DUXYheGfVJQZyu8c42soEWqy_Fd6XPO2SvDWh75TpfuSR_8eRwbtBM86GK5ZjohEFQ; isLogin=1; ftID=52105232235491.110eb6e3a9c4ff7ca836f61e4ef891d738092.1010L8o0.A7B85EF186A1E5A2; Hm_lpvt_5244adb4ce18f1d626ffc94627dd9fd7=1687845332; _monitor_extras={"deviceId":"vlWSpjjVwYCjIdprNfoJaX","eventId":412,"sequenceNumber":412}; __cf_bm=W.FHAjw_yeBw4XlI0golZRrPSaN4wiR2PK7MsBnw0Xs-1687851319-0-AZDNitdFv11kkBmKRKvC8UH1VK7EtjLGiDiUFkhG6yEQjDn4k3OneVJCeE6FtDvNvuwrTgIovvL2mE7hsGokm88=',
        'Referer': 'https://www.oklink.com/cn/chaintelligence/compliance-tools',
        //'Referrer-Policy': 'strict-origin-when-cross-origin',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'x-apikey': 'LWIzMWUtNDU0Ny05Mjk5LWI2ZDA3Yjc2MzFhYmEyYzkwM2NjfDI4MDc3NzM0OTg0NzAwNTU=',
        },
        // proxy: false,
        // httpsAgent: new HttpsProxyAgent(`http://127.0.0.1:1087`)
    })

    if (!(result.data?.code == 0)) {
        throw new Error(result.data?.msg)
    }

    return result.data?.data
}