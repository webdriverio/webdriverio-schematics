import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 20 * 1000

async function getWorkspaceTree(appName = 'foobar') {
    const ngRunner = new SchematicTestRunner('@schematics/angular', '');

    const workspaceOptions = {
        name: 'workspace',
        newProjectRoot: 'projects',
        version: '6.0.0',
        defaultProject: appName,
    };

    const appOptions = {
        name: appName,
        inlineTemplate: false,
        routing: false,
        skipTests: false,
        skipPackageJson: false,
    };

    let appTree = await ngRunner.runSchematicAsync('workspace', workspaceOptions).toPromise();
    appTree = await ngRunner.runSchematicAsync('application', appOptions, appTree).toPromise();

    return appTree;
}

describe('webdriverio-schematics', () => {
    it('works', async () => {
        const runner = new SchematicTestRunner(
            '@wdio/schematics',
            path.join(__dirname, '../collection.json')
        );
        const tree = await runner.runSchematicAsync('ng-add', {
            yes: true
        }, await getWorkspaceTree()).toPromise();

        expect(tree.files).toEqual([]);
    });
});
