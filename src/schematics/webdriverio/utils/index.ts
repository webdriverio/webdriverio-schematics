import { get } from 'http'

import {
    Tree,
    SchematicsException
} from '@angular-devkit/schematics'

import {
    JsonAstObject,
    JsonAstNode
} from '@angular-devkit/core'

import {
    NodeDependencyType,
    NodeDependency,
    pkgJson,
    DeleteNodeDependency,
    NodePackage
} from '../types'

import {
    parseJsonAtPath,
    insertPropertyInAstObjectInOrder,
    appendPropertyInAstObject
} from './json'

export function getAngularJsonValue(tree: Tree) {
    const angularJsonAst = parseJsonAtPath(tree, './angular.json');
    return angularJsonAst.value as any;
}

export function getAngularVersion(tree: Tree): number {
    const packageNode = getPackageJsonDependency(tree, '@angular/core');

    const version = packageNode && packageNode.version.split('').find((char) => !!parseInt(char, 10));

    return version ? +version : 0;
}

export function deleteDirectory(tree: Tree, path: string): void {
    try {
        tree.delete(path);
    } catch {}
}

function findPropertyInAstObject(
    node: JsonAstObject,
    propertyName: string
): JsonAstNode | null {
    let maybeNode: JsonAstNode | null = null;
    for (const property of node.properties) {
        if (property.key.value == propertyName) {
            maybeNode = property.value;
        }
    }

    return maybeNode;
}

function getPackageJsonDependency(tree: Tree, name: string): NodeDependency | null {
    const packageJson = parseJsonAtPath(tree, pkgJson.Path)
    let dep: NodeDependency | null = null;

    [
        NodeDependencyType.Default,
        NodeDependencyType.Dev,
        NodeDependencyType.Optional,
        NodeDependencyType.Peer
    ].forEach((depType) => {
        if (dep !== null) {
            return
        }

        const depsNode = findPropertyInAstObject(packageJson, depType)
        if (depsNode !== null && depsNode.kind === 'object') {
            const depNode = findPropertyInAstObject(depsNode, name)
            if (depNode !== null && depNode.kind === 'string') {
                const version = depNode.value
                dep = {
                    type: depType,
                    name: name,
                    version: version
                }
            }
        }
    })

    return dep
}

export function removePackageJsonDependency(tree: Tree, dependency: DeleteNodeDependency): void {
    const packageJsonAst = parseJsonAtPath(tree, pkgJson.Path)
    const depsNode = findPropertyInAstObject(packageJsonAst, dependency.type)
    const recorder = tree.beginUpdate(pkgJson.Path)

    if (!depsNode) {
        // Haven't found the dependencies key.
        new SchematicsException('Could not find the package.json dependency')
        return tree.commitUpdate(recorder)
    }

    if (depsNode.kind === 'object') {
        const fullPackageString = depsNode.text
            .split('\n')
            .filter((pkg) => pkg.includes(`"${dependency.name}"`))[0]

        const commaDangle = (
            fullPackageString &&
            fullPackageString.trim().slice(-1) === ',' ? 1 : 0
        )

        const packageAst = depsNode.properties.find((node) => (
            node.key.value.toLowerCase() === dependency.name.toLowerCase()
        ))

        // TODO: does this work for the last dependency?
        const newLineIndentation = 5

        if (packageAst) {
            // Package found, remove it.
            const end = packageAst.end.offset + commaDangle

            recorder.remove(
                packageAst.key.start.offset,
                end - packageAst.start.offset + newLineIndentation
            )
        }

        return tree.commitUpdate(recorder)
    }
}

/**
 * Attempt to retrieve the latest package version from NPM
 * Return an optional "latest" version in case of error
 * @param packageName
 */
export function getLatestNodeVersion(packageName: string): Promise<NodePackage> {
    const DEFAULT_VERSION = 'latest';

    return new Promise((resolve) => {
      return get(`http://registry.npmjs.org/${packageName}`, (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          try {
            const response = JSON.parse(rawData);
            const version = (response && response['dist-tags']) || {};

            resolve(buildPackage(packageName, version.latest));
          } catch (e) {
            resolve(buildPackage(packageName));
          }
        });
      }).on('error', () => resolve(buildPackage(packageName)));
    });

    function buildPackage(name: string, version: string = DEFAULT_VERSION): NodePackage {
      return { name, version };
    }
}

export function addPackageJsonDependency(tree: Tree, dependency: NodeDependency): void {
    const packageJsonAst = parseJsonAtPath(tree, pkgJson.Path);
    const depsNode = findPropertyInAstObject(packageJsonAst, dependency.type);
    const recorder = tree.beginUpdate(pkgJson.Path);

    if (!depsNode) {
      // Haven't found the dependencies key, add it to the root of the package.json.
        appendPropertyInAstObject(
            recorder,
            packageJsonAst,
            dependency.type,
            {
                [dependency.name]: dependency.version,
            },
            4
        );
    } else if (depsNode.kind === 'object') {
        // check if package already added
        const depNode = findPropertyInAstObject(depsNode, dependency.name);

        if (!depNode) {
            // Package not found, add it.
            insertPropertyInAstObjectInOrder(recorder, depsNode, dependency.name, dependency.version, 4);
        } else if (dependency.overwrite) {
            // Package found, update version if overwrite.
            const { end, start } = depNode;
            recorder.remove(start.offset, end.offset - start.offset);
            recorder.insertRight(start.offset, JSON.stringify(dependency.version));
        }
    }

    tree.commitUpdate(recorder);
}

export const removeE2ELinting = (tree: Tree, angularJsonVal: any, project: string) => {
    const projectLintOptionsJson = angularJsonVal.projects[project]?.architect?.lint?.options;
    if (projectLintOptionsJson) {
        let filteredTsConfigPaths

        if (Array.isArray(projectLintOptionsJson['tsConfig'])) {
            filteredTsConfigPaths = projectLintOptionsJson?.tsConfig?.filter((path: string) => {
                const pathIncludesE2e = path.includes('e2e')
                return !pathIncludesE2e && path
            });
        } else {
            filteredTsConfigPaths = !projectLintOptionsJson?.tsConfig?.includes('e2e')
                ? projectLintOptionsJson?.tsConfig
                : ''
        }

        projectLintOptionsJson['tsConfig'] = filteredTsConfigPaths
    }

    return tree.overwrite(
        './angular.json',
        JSON.stringify(angularJsonVal, null, 2)
    )
}

export const addWDIOTsConfig = (tree: Tree, angularJsonVal: any, projectName: string) => {
    const project = angularJsonVal.projects[projectName];
    let tsConfig = project?.architect?.lint?.options?.tsConfig;
    if (tsConfig) {
        let prefix = '';
        if (project.root) {
            prefix = `${project.root}/`;
        }
        if (!Array.isArray(tsConfig)) {
            project.architect.lint.options.tsConfig = tsConfig = [tsConfig];
        }
        tsConfig.push(`${prefix}webdriverio/tsconfig.json`);
    }

    return tree.overwrite(
        './angular.json',
        JSON.stringify(angularJsonVal, null, 2)
    );
  }
