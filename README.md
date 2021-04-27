WebdriverIO Angular Schematic [![Test](https://github.com/webdriverio/webdriverio-schematics/actions/workflows/test.yaml/badge.svg)](https://github.com/webdriverio/webdriverio-schematics/actions/workflows/test.yaml)
=============================

<p align="center">
  <img alt="WebdriverIO Schematic Logo" src="/.github/assets/logo.png" width=300 />
</p>

Add [WebdriverIO](https://webdriver.io) to an Angular CLI project

This schematic will:

- install WebdriverIO and its dependencies
- add necessary files for WebdriverIO to work with Angular & Typescript
- prompt for removal of Protractor files and configuration

## Usage 🚀

Run as one command in an Angular CLI app directory. Note this will add the schematic as a dependency to your project.

```shell
ng add @wdio/schematics
```

With the custom builder installed, you can run WebdriverIO with the following commands:

```shell script
ng e2e
```

or

```shell script
ng run {your-project-name}:wdio-run
# or run wdio directly via
npx wdio run wdio.conf.js
```

These two commands do the same thing. They will launch the WebdriverIO testrunner.

#### Parameter Options

When adding WebdriverIO Schematics to your project you can invoke the following options:

| Option | Description |
| ------ | ----------- |
| `--removeProtractor` | When true, the protractor dependency and e2e directory will be removed from the project |
| `--noWizard` | When true, it does not run the WebdriverIO setup wizard, requiring the user setup the framework by themselves |
| `--noBuilder` | When true, the angular.json file will not be modified to add WebdriverIO commands, requiring the user to run WebdriverIO from the command line independent of the Angular CLI |
| `--yes` | When true, it configures WebdriverIO with default settings. |
| `--yarn` | When true, it uses yarn rather than npm. |

For example to add a basic WebdriverIO setup without going through the configuration wizard, just run:

```sh
$ ng add @wdio/schematics --yes
```

Once WebdriverIO is added to your project you can apply the common [WDIO CLI options](https://webdriver.io/docs/clioptions) when triggering the test.

## Development 🛠

### Getting started

⚙ [Node.js and npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) are required for the scripts. Make sure it's installed on your machine.

⬇ **Install** the dependencies for the schematic and the sandbox application

```bash
$ npm i && cd sandbox && npm i && cd ..
```

🖇 **Link** the schematic in the sandbox to run locally

```bash
$ npm run link:sandbox
```

🏃 **Run** the schematic

```bash
$ cd sandbox
$ npx ng add @wdio/schematics
```

## E2E testing

Execute the schematic against the sandbox.

```bash
npm run test
```

## Reset the sandbox

Running the schematic locally makes file system changes. The sandbox is version controlled so that viewing a diff of the changes is trivial. After the schematic has run locally, reset the sandbox with the following.

```bash
npm run clean
```

---

Parts of the implementation were based of [`@briebug/cypress-schematic`](https://github.com/briebug/cypress-schematic/blob/master/README.md). Thank you!
