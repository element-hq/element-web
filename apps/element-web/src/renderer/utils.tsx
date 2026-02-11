/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type DOMNode, Element, type HTMLReactParserOptions, Text } from "html-react-parser";
import { type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";

/**
 * The type of a parent node of an element, normally exported by domhandler but that is not a direct dependency of ours
 */
export type ParentNode = NonNullable<Element["parentNode"]>;

/**
 * Returns the text content of a node if it is the only child and that child is a text node
 * @param node - the node to check
 */
export const getSingleTextContentNode = (node: Element): string | null => {
    if (node.childNodes.length === 1 && node.childNodes[0].type === "text") {
        return node.childNodes[0].data;
    }
    return null;
};

/**
 * Returns true if the node has a parent that matches the given matcher
 * @param node - the node to check
 * @param matcher - a function that returns true if the node matches
 */
export const hasParentMatching = (node: Element, matcher: (node: ParentNode | null) => boolean): boolean => {
    let parent = node.parentNode;
    while (parent) {
        if (matcher(parent)) return true;
        parent = parent.parentNode;
    }
    return false;
};

/**
 * A replacer function that can be used with html-react-parser
 */
export type Replacer = HTMLReactParserOptions["replace"];

/**
 * Passes through any non-string inputs verbatim, as such they should only be used for emoji bodies
 */
export function applyReplacerOnString(
    input: string | JSX.Element[],
    replacer: Replacer,
): JSX.Element | JSX.Element[] | string {
    if (!replacer) return input;

    const arr = Array.isArray(input) ? input : [input];
    return arr.map((input, index): JSX.Element => {
        if (typeof input === "string") {
            return (
                <React.Fragment key={index}>{(replacer(new Text(input), 0) as JSX.Element) || input}</React.Fragment>
            );
        }
        return input;
    });
}

interface Parameters {
    isHtml: boolean;
    replace: Replacer;
    // Required for keywordPillRenderer
    keywordRegexpPattern?: RegExp;
    // Required for mentionPillRenderer
    mxEvent?: MatrixEvent;
    room?: Room;
    shouldShowPillAvatar?: boolean;
}

type SpecialisedReplacer<T extends DOMNode> = (
    node: T,
    parameters: Parameters,
    index: number,
) => JSX.Element | string | void;

/**
 * A map of replacer functions for different types of nodes/tags.
 * When a function returns a JSX element, the element will be rendered in place of the node.
 */
export type RendererMap = Partial<
    {
        [tagName in keyof HTMLElementTagNameMap]: SpecialisedReplacer<Element>;
    } & {
        [Node.TEXT_NODE]: SpecialisedReplacer<Text>;
    }
>;

type PreparedRenderer = (parameters: Omit<Parameters, "replace">) => Replacer;

/**
 * Combines multiple renderers into a single Replacer function
 * @param renderers - the list of renderers to combine
 */
export const combineRenderers =
    (...renderers: RendererMap[]): PreparedRenderer =>
    (parameters) => {
        const replace: Replacer = (node, index) => {
            if (node.type === "text") {
                for (const replacer of renderers) {
                    const result = replacer[Node.TEXT_NODE]?.(node, parametersWithReplace, index);
                    if (result) return result;
                }
            }
            if (node instanceof Element) {
                const tagName = node.tagName.toLowerCase() as keyof HTMLElementTagNameMap;
                for (const replacer of renderers) {
                    const result = replacer[tagName]?.(node, parametersWithReplace, index);
                    if (result) return result;
                }
            }
        };
        const parametersWithReplace: Parameters = { ...parameters, replace };
        return replace;
    };
