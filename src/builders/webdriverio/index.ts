import * as url from 'url'

import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
  targetFromTargetString
} from '@angular-devkit/architect'
import { JsonObject, json, tags } from '@angular-devkit/core'

import Launcher from '@wdio/cli'
import type { RunCommandArguments } from '@wdio/cli'

export default createBuilder<JsonObject & Options>(execute);

interface Options extends RunCommandArguments {
    configFile: string
    devServerTarget: string
    watch: boolean
}

export async function execute(
    options: Options,
    context: BuilderContext,
): Promise<BuilderOutput> {
    console.log('RUN ME');

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

    try {
        if (!options.configFile) {
            throw new Error('missing parameter: --configFile /path/to/wdio.conf.ts')
        }

        const launcher = new Launcher(
            options.configFile,
            { ...options, baseUrl: baseUrl }
        )

        return launcher.run().then(
            (exitCode) => ({
                success: exitCode === 0
            }),
            (err) => ({
                error: err.message,
                success: false,
            })
        )
    } catch (err) {
        return {
            error: err.message,
            success: false
        };
    } finally {
        if (server) {
            await server.stop();
        }
    }
}
