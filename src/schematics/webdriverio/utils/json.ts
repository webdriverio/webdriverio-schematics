import * as ts from 'typescript';
import { JsonValue } from '@angular-devkit/core';

import {
    UpdateRecorder,
    SchematicsException,
    Tree
} from '@angular-devkit/schematics';

export interface JsonAstPosition {
    offset: number;
}

export interface JsonAstNodeBase {
    start: JsonAstPosition;
    end: JsonAstPosition;
    text: string;
    value: JsonValue;
}

export interface JsonAstKeyValue {
    kind: 'keyvalue';
    key: JsonAstString;
    value: JsonAstNode;
    start: JsonAstPosition;
    end: JsonAstPosition;
    text: string;
}

export interface JsonAstObject extends JsonAstNodeBase {
    kind: 'object';
    properties: JsonAstKeyValue[];
    value: { [key: string]: JsonValue };
}

export interface JsonAstArray extends JsonAstNodeBase {
    kind: 'array';
    elements: JsonAstNode[];
    value: JsonValue[];
}

export interface JsonAstString extends JsonAstNodeBase {
    kind: 'string';
    value: string;
}

export interface JsonAstNumber extends JsonAstNodeBase {
    kind: 'number';
    value: number;
}

export interface JsonAstBoolean extends JsonAstNodeBase {
    kind: 'true' | 'false';
    value: boolean;
}

export interface JsonAstNull extends JsonAstNodeBase {
    kind: 'null';
    value: null;
}

export type JsonAstNode =
    | JsonAstObject
    | JsonAstArray
    | JsonAstString
    | JsonAstNumber
    | JsonAstBoolean
    | JsonAstNull;

export enum JsonParseMode {
    Strict = 0,
    Loose = 1,
}

export function parseJsonAst(content: string, _mode: JsonParseMode = JsonParseMode.Strict): JsonAstNode {
    const parsedValue = JSON.parse(content) as JsonValue;
    const sourceFile = ts.parseJsonText('json.json', content);
    const statement = sourceFile.statements[0];
    if (!statement) {
        throw new SchematicsException('Invalid JSON content.');
    }

    function convertExpression(expr: ts.Expression, val: JsonValue): JsonAstNode {
        const start = { offset: expr.getStart(sourceFile) };
        const end = { offset: expr.getEnd() };
        const text = content.slice(start.offset, end.offset);

        if (ts.isObjectLiteralExpression(expr)) {
            const objVal = (val && typeof val === 'object' && !Array.isArray(val) ? val : {}) as { [key: string]: JsonValue };
            const properties: JsonAstKeyValue[] = expr.properties
                .filter((prop): prop is ts.PropertyAssignment => ts.isPropertyAssignment(prop))
                .map((prop) => {
                    const keyExpr = prop.name;
                    const keyStart = { offset: keyExpr.getStart(sourceFile) };
                    const keyEnd = { offset: keyExpr.getEnd() };
                    const keyText = content.slice(keyStart.offset, keyEnd.offset);
                    const keyVal = ts.isStringLiteral(keyExpr) ? keyExpr.text : keyExpr.getText(sourceFile);
                    const propVal = convertExpression(prop.initializer, objVal[keyVal]);
                    const propStart = { offset: prop.getStart(sourceFile) };
                    const propEnd = { offset: prop.getEnd() };
                    return {
                        kind: 'keyvalue',
                        key: {
                            kind: 'string',
                            start: keyStart,
                            end: keyEnd,
                            text: keyText,
                            value: keyVal,
                        },
                        value: propVal,
                        start: propStart,
                        end: propEnd,
                        text: content.slice(propStart.offset, propEnd.offset),
                    };
                });
            return {
                kind: 'object',
                start,
                end,
                text,
                value: objVal,
                properties,
            };
        }

        if (ts.isArrayLiteralExpression(expr)) {
            const arrVal = (Array.isArray(val) ? val : []) as JsonValue[];
            const elements = expr.elements.map((el, idx) => convertExpression(el, arrVal[idx]));
            return {
                kind: 'array',
                start,
                end,
                text,
                value: arrVal,
                elements,
            };
        }

        if (ts.isStringLiteral(expr)) {
            return {
                kind: 'string',
                start,
                end,
                text,
                value: val as string,
            };
        }

        if (ts.isNumericLiteral(expr) || ts.isPrefixUnaryExpression(expr)) {
            return {
                kind: 'number',
                start,
                end,
                text,
                value: val as number,
            };
        }

        if (expr.kind === ts.SyntaxKind.TrueKeyword) {
            return {
                kind: 'true',
                start,
                end,
                text,
                value: true,
            };
        }

        if (expr.kind === ts.SyntaxKind.FalseKeyword) {
            return {
                kind: 'false',
                start,
                end,
                text,
                value: false,
            };
        }

        return {
            kind: 'null',
            start,
            end,
            text,
            value: null,
        };
    }

    return convertExpression(statement.expression, parsedValue);
}

export function appendPropertyInAstObject(
    recorder: UpdateRecorder,
    node: JsonAstObject,
    propertyName: string,
    value: JsonValue,
    indent: number
) {
    const indentStr = _buildIndent(indent);

    if (node.properties.length > 0) {
        // Insert comma.
        const last = node.properties[node.properties.length - 1];
        recorder.insertRight(last.start.offset + last.text.replace(/\s+$/, '').length, ',');
    }

    recorder.insertLeft(
        node.end.offset - 1,
        '  ' +
        `"${propertyName}": ${JSON.stringify(value, null, 2).replace(/\n/g, indentStr)}` +
        indentStr.slice(0, -2)
    );
}

export function insertPropertyInAstObjectInOrder(
    recorder: UpdateRecorder,
    node: JsonAstObject,
    propertyName: string,
    value: JsonValue,
    indent: number
) {
    if (node.properties.length === 0) {
        appendPropertyInAstObject(recorder, node, propertyName, value, indent);
        return;
    }

    // Find insertion info.
    let insertAfterProp: JsonAstKeyValue | null = null;
    let prev: JsonAstKeyValue | null = null;
    let isLastProp = false;
    const last = node.properties[node.properties.length - 1];
    for (const prop of node.properties) {
        if (prop.key.value > propertyName) {
            if (prev) {
                insertAfterProp = prev;
            }
            break;
        }
        if (prop === last) {
            isLastProp = true;
            insertAfterProp = last;
        }
        prev = prop;
    }

    if (isLastProp) {
        appendPropertyInAstObject(recorder, node, propertyName, value, indent);
        return;
    }

    const indentStr = _buildIndent(indent);

    const insertIndex = insertAfterProp === null
        ? node.start.offset + 1
        : insertAfterProp.end.offset + 1

    recorder.insertRight(
        insertIndex,
        `${indentStr}` +
        `"${propertyName}": ${JSON.stringify(value, null, 2).replace(/\n/g, indentStr)}` +
        ','
    )
}

export function appendValueInAstArray(
    recorder: UpdateRecorder,
    node: JsonAstArray,
    value: JsonValue,
    indent = 4
) {
    const indentStr = _buildIndent(indent);

    if (node.elements.length > 0) {
        // Insert comma.
        const last = node.elements[node.elements.length - 1];
        recorder.insertRight(last.start.offset + last.text.replace(/\s+$/, '').length, ',');
    }

    recorder.insertLeft(
        node.end.offset - 1,
        '  ' + JSON.stringify(value, null, 2).replace(/\n/g, indentStr) + indentStr.slice(0, -2)
    )
}

export function findPropertyInAstObject(
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

function _buildIndent(count: number): string {
    return '\n' + new Array(count + 1).join(' ');
}

export function parseJsonAtPath(tree: Tree, path: string): JsonAstObject {
    const buffer = tree.read(path)

    if (buffer === null) {
        throw new SchematicsException(`Could not read ${path}.`)
    }

    const content = buffer.toString()

    const json = parseJsonAst(content, JsonParseMode.Strict)
    if (json.kind != 'object') {
        throw new SchematicsException(`Invalid ${path}. Was expecting an object`)
    }

    return json
}
