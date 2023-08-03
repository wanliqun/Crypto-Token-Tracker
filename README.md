oclif-hello-world
=================

oclif example Hello World CLI

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![CircleCI](https://circleci.com/gh/oclif/hello-world/tree/main.svg?style=shield)](https://circleci.com/gh/oclif/hello-world/tree/main)
[![GitHub license](https://img.shields.io/github/license/oclif/hello-world)](https://github.com/oclif/hello-world/blob/main/LICENSE)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g crypto-money-tracker
$ crypto-money-tracker COMMAND
running command...
$ crypto-money-tracker (--version)
crypto-money-tracker/0.0.1 darwin-x64 node-v18.16.0
$ crypto-money-tracker --help [COMMAND]
USAGE
  $ crypto-money-tracker COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`crypto-money-tracker base`](#crypto-money-tracker-base)
* [`crypto-money-tracker eth`](#crypto-money-tracker-eth)
* [`crypto-money-tracker eth track`](#crypto-money-tracker-eth-track)
* [`crypto-money-tracker help [COMMANDS]`](#crypto-money-tracker-help-commands)
* [`crypto-money-tracker plugins`](#crypto-money-tracker-plugins)
* [`crypto-money-tracker plugins:install PLUGIN...`](#crypto-money-tracker-pluginsinstall-plugin)
* [`crypto-money-tracker plugins:inspect PLUGIN...`](#crypto-money-tracker-pluginsinspect-plugin)
* [`crypto-money-tracker plugins:install PLUGIN...`](#crypto-money-tracker-pluginsinstall-plugin-1)
* [`crypto-money-tracker plugins:link PLUGIN`](#crypto-money-tracker-pluginslink-plugin)
* [`crypto-money-tracker plugins:uninstall PLUGIN...`](#crypto-money-tracker-pluginsuninstall-plugin)
* [`crypto-money-tracker plugins:uninstall PLUGIN...`](#crypto-money-tracker-pluginsuninstall-plugin-1)
* [`crypto-money-tracker plugins:uninstall PLUGIN...`](#crypto-money-tracker-pluginsuninstall-plugin-2)
* [`crypto-money-tracker plugins update`](#crypto-money-tracker-plugins-update)
* [`crypto-money-tracker tron`](#crypto-money-tracker-tron)
* [`crypto-money-tracker tron track`](#crypto-money-tracker-tron-track)

## `crypto-money-tracker base`

```
USAGE
  $ crypto-money-tracker base -t <value> -a <value>

FLAGS
  -a, --address=<value>  (required) tracking address
  -t, --token=<value>    (required) token address
```

_See code: [dist/commands/base.ts](https://github.com/Conflux-Chain/crypto-money-tracker/blob/v0.0.1/dist/commands/base.ts)_

## `crypto-money-tracker eth`

Tracking crypto-currency money flow on Ethereum network

```
USAGE
  $ crypto-money-tracker eth

DESCRIPTION
  Tracking crypto-currency money flow on Ethereum network
```

_See code: [dist/commands/eth/index.ts](https://github.com/Conflux-Chain/crypto-money-tracker/blob/v0.0.1/dist/commands/eth/index.ts)_

## `crypto-money-tracker eth track`

track token transfers for db persistence

```
USAGE
  $ crypto-money-tracker eth track -t <value> -a <value>

FLAGS
  -a, --address=<value>  (required) tracking address
  -t, --token=<value>    (required) token address

DESCRIPTION
  track token transfers for db persistence

EXAMPLES
  $ crypto-money-tracker eth track
```

## `crypto-money-tracker help [COMMANDS]`

Display help for crypto-money-tracker.

```
USAGE
  $ crypto-money-tracker help [COMMANDS] [-n]

ARGUMENTS
  COMMANDS  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for crypto-money-tracker.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v5.2.14/src/commands/help.ts)_

## `crypto-money-tracker plugins`

List installed plugins.

```
USAGE
  $ crypto-money-tracker plugins [--core]

FLAGS
  --core  Show core plugins.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ crypto-money-tracker plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.4.7/src/commands/plugins/index.ts)_

## `crypto-money-tracker plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ crypto-money-tracker plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Installs a plugin into the CLI.
  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.


ALIASES
  $ crypto-money-tracker plugins add

EXAMPLES
  $ crypto-money-tracker plugins:install myplugin 

  $ crypto-money-tracker plugins:install https://github.com/someuser/someplugin

  $ crypto-money-tracker plugins:install someuser/someplugin
```

## `crypto-money-tracker plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ crypto-money-tracker plugins:inspect PLUGIN...

ARGUMENTS
  PLUGIN  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ crypto-money-tracker plugins:inspect myplugin
```

## `crypto-money-tracker plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ crypto-money-tracker plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Installs a plugin into the CLI.
  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.


ALIASES
  $ crypto-money-tracker plugins add

EXAMPLES
  $ crypto-money-tracker plugins:install myplugin 

  $ crypto-money-tracker plugins:install https://github.com/someuser/someplugin

  $ crypto-money-tracker plugins:install someuser/someplugin
```

## `crypto-money-tracker plugins:link PLUGIN`

Links a plugin into the CLI for development.

```
USAGE
  $ crypto-money-tracker plugins:link PLUGIN

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Links a plugin into the CLI for development.
  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ crypto-money-tracker plugins:link myplugin
```

## `crypto-money-tracker plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ crypto-money-tracker plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ crypto-money-tracker plugins unlink
  $ crypto-money-tracker plugins remove
```

## `crypto-money-tracker plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ crypto-money-tracker plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ crypto-money-tracker plugins unlink
  $ crypto-money-tracker plugins remove
```

## `crypto-money-tracker plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ crypto-money-tracker plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ crypto-money-tracker plugins unlink
  $ crypto-money-tracker plugins remove
```

## `crypto-money-tracker plugins update`

Update installed plugins.

```
USAGE
  $ crypto-money-tracker plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

## `crypto-money-tracker tron`

Tracking crypto-currency money flow on TRON network

```
USAGE
  $ crypto-money-tracker tron

DESCRIPTION
  Tracking crypto-currency money flow on TRON network
```

_See code: [dist/commands/tron/index.ts](https://github.com/Conflux-Chain/crypto-money-tracker/blob/v0.0.1/dist/commands/tron/index.ts)_

## `crypto-money-tracker tron track`

track token transfers for db persistence

```
USAGE
  $ crypto-money-tracker tron track -t <value> -a <value>

FLAGS
  -a, --address=<value>  (required) tracking address
  -t, --token=<value>    (required) token address

DESCRIPTION
  track token transfers for db persistence

EXAMPLES
  $ crypto-money-tracker tron track
```
<!-- commandsstop -->
