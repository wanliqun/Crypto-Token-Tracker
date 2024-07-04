import axios from "axios";
import mysql from "mysql2/promise";
import config from "../config.json";
import { HttpsProxyAgent } from 'https-proxy-agent';

const API_KEY = config.api_keys;
const USDT_CONTRACT_ADDRESS = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const endpoint = "https://api.etherscan.io/api";


interface Transaction {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
}

const api_keys = config.api_keys;
let apiKeyIndex = 0;

function getNextApiKey(): string {
  const apiKey = api_keys[apiKeyIndex];
  apiKeyIndex = (apiKeyIndex + 1) % api_keys.length;
  return apiKey;
}


const params: any = {
  module: "account",
  action: "tokentx",
  contractaddress: "0xdac17f958d2ee523a2206206994597c13d831ec7", 
  address: "0x36928500bc1dcd7af6a2b4008875cc336b927d57", //要查询的地址
  page: 1,
  offset: 100,
  startblock: 0,
  endblock: 27025780,
  sort: "asc",
  apikey: getNextApiKey()
  // apikey: "AATYZ1K4NP7AGW299HPD79KCJRYRTB8BIN"

};

const pool = mysql.createPool({
  host: config.database.host,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});


async function fetchTransactions(): Promise<Transaction[]> {
  try {
    const response = await axios.get(endpoint, {
      params: { ...params, apikey: getNextApiKey() },
      proxy: false,
      httpsAgent: new HttpsProxyAgent(`http://127.0.0.1:1087`)
    });
    if (response.data.status !== '1') {
      throw new Error('Failed to fetch transactions');
    }
    return response.data.result as Transaction[];
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
}


//这部分sql单独写出去

async function createTableIfNotExists(connection: mysql.Connection): Promise<void> {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS usdt_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      block_number VARCHAR(255) NOT NULL,
      timestamp VARCHAR(255) NOT NULL,
      hash VARCHAR(255) NOT NULL,
      from_address VARCHAR(255) NOT NULL,
      to_address VARCHAR(255) NOT NULL,
      value VARCHAR(255) NOT NULL
    )
  `;


  try {
    const connection = await pool.getConnection();
    await connection.query(createTableSQL);
    connection.release();
  } catch (error) {
    console.error('Error creating table:', error);
    throw error;
  }
}



async function insertTransactionsIntoDatabase(transactions: Transaction[]): Promise<void> {

  const sql = `
    INSERT INTO usdt_transactions (block_number, timestamp, hash, from_address, to_address, value)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  const values = transactions.map(tx => [
    tx.blockNumber,
    tx.timeStamp,
    tx.hash,
    tx.from,
    tx.to,
    tx.value
  ]);




  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    for (const value of values) {
      await connection.query(sql, value);
    }
    await connection.commit();
    connection.release();
  } catch (error) {
    console.error('Error inserting transactions into database:', error);
    throw error;
  }

}


async function main(): Promise<void> {
  try {
    //await createTableIfNotExists();
    const transactions = await fetchTransactions();
    await insertTransactionsIntoDatabase(transactions);
    console.log('Transactions successfully inserted into database');
  } catch (error) {
    console.error('Error in main function:', error);
  } finally {
    await pool.end();
  }
}

main();