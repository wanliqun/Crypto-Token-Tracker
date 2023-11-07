import * as mysql from 'mysql2'
import confj from '../config.json'
import {createLogger, transports, format} from 'winston'
import {AsyncQueueWorkerPool, IWorkerPool} from '../workers/workerpool'
import {ICrawler} from '../crawlers/interface'
import {TronScanCrawler} from '../crawlers/tronscan'
import {TronScanAddressStore, TronScanTokenTransferStore} from '../store/tron'
import {OklinkAddressStore, OklinkTokenTransferStore} from '../store/oklink'
import {OklinkCrawlerV2} from '../crawlers/oklink-v2'
import {TronTracker} from '../tracker/tron'
import { EthTracker } from '../tracker/eth'
import {OkLinkReporter} from '../reports/oklink'
import {IReporter} from '../reports/interface'
import { TronScanReporter } from '../reports/tronscan'
import { IMarker } from '../marker/interface'
import { OkLinkMarker } from '../marker/oklink'
import { TronScanMarker } from '../marker/tronscan'

const chainTron = 'TRX'
const chainEth = 'ETH'

if (process.env.LOG_LEVEL) {
  confj.log_level = process.env.LOG_LEVEL
  console.log("Overridden with env LOG_LEVEL", confj.log_level)
}

if (process.env.MAX_TRACK_OUT_DEPTH) {
  confj.max_out_depth = Number(process.env.MAX_TRACK_OUT_DEPTH)
  console.log("Overridden with env MAX_TRACK_OUT_DEPTH", confj.max_out_depth)
}

if (process.env.MAX_TRACK_IN_DEPTH) {
  confj.max_in_depth = Number(process.env.MAX_TRACK_IN_DEPTH)
  console.log("Overridden with env MAX_TRACK_IN_DEPTH", confj.max_in_depth)
}

if (process.env.WORKER_POOL_SIZE) {
  confj.worker_pool_size = Number(process.env.WORKER_POOL_SIZE)
  console.log("Overridden with env WORKER_POOL_SIZE", confj.worker_pool_size)
}

export const logger = createLogger({
  level: confj.log_level,
  // format: format.json(),
  format: format.combine(
    format.colorize(),
    format.timestamp(),
    format.simple(),
  ),
  transports: [
    confj.log_path ? new transports.File({filename: confj.log_path}) : new transports.Console(),
    // new transports.File({ filename: 'error.log', level: 'error' }),
  ],
})

export const skipZeroTrade = () => {
  return confj.skip_zero_transfer
}

export const getMinCollectTransferAmount = () => {
  return confj.min_collect_transfer_amount
}

export const getMaxConcurrency = () => {
  return confj.worker_pool_size
}

// factory method to get MySQL database connection.
export const getMysqlPool = async () => {
  const {host, user, password, database} = confj.database
  const dbc = mysql.createConnection({
    host: host,
    user: user,
    password: password,
  })

  // create database if not existed yet
  await dbc.promise().execute(
    `CREATE DATABASE IF NOT EXISTS ${database} CHARACTER SET "utf8mb4" COLLATE "utf8mb4_general_ci"`)
  dbc.end()

  return mysql.createPool({
    host: host,
    user: user,
    password: password,
    database: database,
  })
}

// factory method to get worker pool
export const getWorkerPool = async () => {
  return new AsyncQueueWorkerPool({concurrency: confj.worker_pool_size})
}

// factory method to get TRON crawler
export const getTronCrawler = async (dbpool: mysql.Pool): Promise<ICrawler> => {
  if (confj.tron.data_source == 'oklink') { // crawl from oklink?
    const transferStore = await OklinkTokenTransferStore.singleton(dbpool, chainTron)
    const addrStore = await OklinkAddressStore.singleton(dbpool, chainTron)

    return new OklinkCrawlerV2(dbpool, chainTron, transferStore, addrStore)
  }

  // otherwise, use tronscan as default
  const transferStore = await TronScanTokenTransferStore.singleton(dbpool)
  const addrStore = await TronScanAddressStore.singleton(dbpool)

  return new TronScanCrawler(dbpool, transferStore, addrStore)
}

// factory method to get TRON tracker
export const getTronTracker = async (
  dbpool: mysql.Pool, workerpool: IWorkerPool, crawler: ICrawler,
  maxOutDepth: number | undefined = undefined,
  maxInDepth: number | undefined = undefined): Promise<TronTracker> => {
  const addrStore = await (confj.tron.data_source == 'oklink' ?
    OklinkAddressStore.singleton(dbpool, chainTron) : TronScanAddressStore.singleton(dbpool)
  )
  return new TronTracker(
    dbpool, addrStore, workerpool, crawler,
    maxOutDepth ?? confj.max_out_depth,
    maxInDepth ?? confj.max_in_depth,
  )
}

// factory method to get TRON reporter
export const getTronReporter = async (dbpool: mysql.Pool): Promise<IReporter> => {
  if (confj.tron.data_source == 'oklink') { // data source from oklink?
    const transferStore = await OklinkTokenTransferStore.singleton(dbpool, chainTron)
    const addrStore = await OklinkAddressStore.singleton(dbpool, chainTron)

    return new OkLinkReporter(chainTron, dbpool, transferStore, addrStore)
  }

  // otherwise, use tronscan as data source
  const transferStore = await TronScanTokenTransferStore.singleton(dbpool)
  const addrStore = await TronScanAddressStore.singleton(dbpool)

  return new TronScanReporter(dbpool, transferStore, addrStore)
}

// factory method to get TRON marker
export const getTronMarker = async (dbpool: mysql.Pool): Promise<IMarker> => {
  if (confj.tron.data_source == 'oklink') { // data source from oklink?
    const transferStore = await OklinkTokenTransferStore.singleton(dbpool, chainTron)
    const addrStore = await OklinkAddressStore.singleton(dbpool, chainTron)

    return new OkLinkMarker(chainTron, dbpool, transferStore, addrStore)
  }

  // otherwise, use tronscan as data source
  const transferStore = await TronScanTokenTransferStore.singleton(dbpool)
  const addrStore = await TronScanAddressStore.singleton(dbpool)

  return new TronScanMarker(dbpool, transferStore, addrStore)
}

// factory method to get ETH crawler
export const getEthCrawler = async (dbpool: mysql.Pool): Promise<ICrawler> => {
  const transferStore = await OklinkTokenTransferStore.singleton(dbpool, chainEth)
  const addrStore = await OklinkAddressStore.singleton(dbpool, chainEth)

  return new OklinkCrawlerV2(dbpool, chainEth, transferStore, addrStore)
}

// factory method to get ETH tracker
export const getEthTracker = async (dbpool: mysql.Pool, workerpool: IWorkerPool, crawler: ICrawler) => {
  const addrStore = await OklinkAddressStore.singleton(dbpool, chainEth)
  return new EthTracker(dbpool, addrStore, workerpool, crawler, confj.max_out_depth, confj.max_in_depth)
}

// factory method to get ETH reporter
export const getEthReporter = async (dbpool: mysql.Pool): Promise<IReporter> => {
  const transferStore = await OklinkTokenTransferStore.singleton(dbpool, chainEth)
  const addrStore = await OklinkAddressStore.singleton(dbpool, chainEth)

  return new OkLinkReporter(chainEth, dbpool, transferStore, addrStore)
}

// factory method to get ETH marker
export const getEthMarker = async (dbpool: mysql.Pool): Promise<IMarker> => {
  const transferStore = await OklinkTokenTransferStore.singleton(dbpool, chainEth)
  const addrStore = await OklinkAddressStore.singleton(dbpool, chainEth)

  return new OkLinkMarker(chainEth, dbpool, transferStore, addrStore)
}