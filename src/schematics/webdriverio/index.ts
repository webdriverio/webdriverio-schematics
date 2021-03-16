import { Rule, SchematicContext, Tree, chain, noop } from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks'
import { map } from 'rxjs/operators'
import { Observable, of } from 'rxjs'

import { NodeDependencyType } from './types'
import { getAngularVersion, removePackageJsonDependency, removeFiles } from './utils'

// You don't have to export the function as default. You can also have more than one rule factory
// per file.
export function webdriverioSchematics(_options: any): Rule {
    return (tree: Tree, _context: SchematicContext) => {
        _options = { ..._options, __version__: getAngularVersion(tree) };

        return chain([
          updateDependencies(_options),
          _options.removeProtractor ? removeFiles() : noop(),
        //   addCypressFiles(),
        //   _options.addCypressTestScripts ? addCypressTestScriptsToPackageJson() : noop(),
        //   !_options.noBuilder ? modifyAngularJson(_options) : noop(),
        ])(tree, _context);
    };
}

function updateDependencies(options: any): Rule {
    let removeDependencies: Observable<Tree>;
    return (tree: Tree, context: SchematicContext): Observable<Tree> => {
        context.logger.debug('Updating dependencies...')
        context.addTask(new NodePackageInstallTask())

        if (options.removeProtractor) {
            removeDependencies = of('protractor').pipe(
                map((packageName: string) => {
                    context.logger.debug(`Removing ${packageName} dependency`);

                    removePackageJsonDependency(tree, {
                        type: NodeDependencyType.Dev,
                        name: packageName,
                    });

                    return tree;
                })
            );
        }

        return removeDependencies

        // const addDependencies = of(
        //     'cypress', '@cypress/webpack-preprocessor', 'ts-loader'
        // ).pipe(
        //     concatMap((packageName: string) => getLatestNodeVersion(packageName)),
        //     map((packageFromRegistry: NodePackage) => {
        //         const { name, version } = packageFromRegistry;
        //         context.logger.debug(`Adding ${name}:${version} to ${NodeDependencyType.Dev}`);

        //         addPackageJsonDependency(tree, {
        //             type: NodeDependencyType.Dev,
        //             name,
        //             version,
        //         });

        //         return tree;
        //     })
        // );

        // if (options.removeProtractor) {
        //     return concat(removeDependencies, addDependencies);
        // }
        // return concat(addDependencies);
    };
}
