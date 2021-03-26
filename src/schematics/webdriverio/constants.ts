export const TS_CONFIG = {
    extends: '../tsconfig.json',
    compilerOptions: {
        module: 'commonjs',
        target: 'es5',
        types: ['node', 'webdriverio/sync', 'expect-webdriverio']
    }
}
