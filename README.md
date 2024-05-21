# Crypto Token Tracker

Crypto Token Tracker is a project built with Node.js and TypeScript, and Yarn. It is designed to track and store address and transaction information of cryptocurrency on the ETH/TRON network.

## Table of Contents
* [Installation](#installation)
* [Usage](#usage)
* [Configuration](#configuration)
* [Commands](#commands)


## Installation

First, you need to install [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/). Then, you can install the project dependencies with the following command:

```bash
npm install
```

Or, if you prefer using Yarn, you can use the following command:

```bash
yarn install
```

## Configuration

To configure the project, you need to copy the `config/config.json.example` file to `config/config.json`. Then, you can configure the project by modifying the `config.json` file.

Here are the detailed instructions:

1. Open the `config.json` file.
2. Replace `data` with your actual database settings.
3. Replace `tronscan.api_keys` with your actual tronscan open api key.
4. Save the changes.

## Commands

- `tron track`: This command is used to start crawling the USDT transfer flow to the exchange into the database from a specified address. Here is an example of how to use it:

```bash
./bin/dev tron track --token TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t --address TSn9sa3oASpEV6xfyCirhoV6hVKu9mB6Gg
```
This command will track the USDT transfers from the address `TSn9sa3oASpEV6xfyCirhoV6hVKu9mB6Gg` on the Tron network and store the transactions into the database.

- `tron report`: This command is used to export the USDT transfer flow to the exchange statistics as a CSV file. Here is an example of how to use it:

```bash
tron report --token TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t --address TBdMNQ3CLEBY2Qtcu8seu4N12tPogyq3xG
```
These commands will calculate and analyse the USDT transfers from the transactions store in the database and export the statistics report as a CSV file.
