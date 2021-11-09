import * as path from 'path'
import * as fs from 'fs'
import * as url from 'url'

import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
  targetFromTargetString
} from '@angular-devkit/architect'
import { JsonObject, json, tags } from '@angular-devkit/core'

import type LauncherType  from '@wdio/cli'
import type { RunCommandArguments } from '@wdio/cli'

export default createBuilder<JsonObject & Options>(execute);

interface Options extends RunCommandArguments {
    configFile: string
    tsconfigFile: string
    devServerTarget: string
    watch: boolean
}

export async function execute(
    options: Options,
    context: BuilderContext,
): Promise<BuilderOutput> {
    const Launcher = require(path.join(process.cwd(), 'node_modules', '@wdio', 'cli')).default

    // ensure that only one of these options is used
    if (options.devServerTarget && options.baseUrl) {
        throw new Error(tags.stripIndents`
            The 'baseUrl' option cannot be used with 'devServerTarget'.
            When present, 'devServerTarget' will be used to automatically setup 'baseUrl' for WebdriverIO.
        `);
    }

    let baseUrl = options.baseUrl
    let server
    if (options.devServerTarget) {
        const target = targetFromTargetString(options.devServerTarget);
        const serverOptions = await context.getTargetOptions(target);

        const overrides = {
            watch: false,
            host: serverOptions.host,
            port: serverOptions.port
        } as json.JsonObject;

        server = await context.scheduleTarget(target, overrides);
        const result = await server.result;
        if (!result.success) {
            return { success: false };
        }

        if (typeof serverOptions.publicHost === 'string') {
            let publicHost = serverOptions.publicHost as string;
            if (!/^\w+:\/\//.test(publicHost)) {
            publicHost = `${serverOptions.ssl
                ? 'https'
                : 'http'}://${publicHost}`;
            }
            const clientUrl = url.parse(publicHost);
            baseUrl = url.format(clientUrl);
        } else if (typeof result.baseUrl === 'string') {
            baseUrl = result.baseUrl;
        }
    }

    // Like the baseUrl in protractor config file when using the API we need to add
    // a trailing slash when provide to the baseUrl.
    if (baseUrl && !baseUrl.endsWith('/')) {
        baseUrl += '/';
    }

    let result: BuilderOutput | undefined;
    try {
        if (!options.configFile) {
            const defaultConfigPath = await Promise.all([
                path.join(process.cwd(), 'wdio.conf.js'),
                path.join(process.cwd(), 'wdio.conf.ts')
            ].map((path: string) => (
                fs.promises.stat(path).then(
                    () => path,
                    () => null
                )
            ))).then(((res) => res.find(Boolean)))

            if (!defaultConfigPath) {
                throw new Error('missing parameter: --configFile /path/to/wdio.conf.ts')
            }

            options.configFile = defaultConfigPath
        }
        
        if (options.tsconfigFile) {
            options.autoCompileOpts = { tsNodeOpts: { project: options.tsconfigFile } }
        }

        const launcher: LauncherType = new Launcher(
            options.configFile,
            { ...options, baseUrl: baseUrl }
        )

        result = await launcher.run().then(
            (exitCode) => ({
                success: exitCode === 0
            }),
            (err) => ({
                error: err.message,
                success: false,
            })
        )
    } catch (err) {
        result = {
            error: err.message,
            success: false
        };
    } finally {
        if (server) {
            await server.stop();
        }
        if (!result) {
            return { success: false };
        }
        return result;
    }
}
