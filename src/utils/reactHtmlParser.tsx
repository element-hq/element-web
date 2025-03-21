/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type DOMNode, Element as ParserElement, type HTMLReactParserOptions, Text } from "html-react-parser";
import { type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";
import { type Opts } from "linkifyjs";

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

/**
 * Converts a Replacer function to a render function for linkify-react
 * So that we can use the same replacer functions for both
 * @param replacer The replacer function to convert
 */
export function replacerToRenderFunction(replacer: Replacer): Opts["render"] {
    if (!replacer) return;
    return ({ tagName, attributes, content }) => {
        const domNode = new ParserElement(tagName, attributes, [new Text(content)], "tag" as ParserElement["type"]);
        const result = replacer(domNode, 0);
        if (result) return result;

        // This is cribbed from the default render function in linkify-react
        if (attributes.class) {
            attributes.className = attributes.class;
            delete attributes.class;
        }
        return React.createElement(tagName, attributes, content);
    };
}

interface Parameters {
    isHtml: boolean;
    tooltipifyAmbiguousUrls?: boolean;
    onHeightChanged?: () => void;
    // Required for pillifyKeywordsReplacer
    keywordRegexpPattern?: RegExp;
    // Required for pillifyMentionsReplacer
    mxEvent?: MatrixEvent;
    room?: Room;
    shouldShowPillAvatar?: boolean;
}

type SpecialisedReplacer<T extends DOMNode> = (
    node: T,
    parameters: Parameters,
    index: number,
) => JSX.Element | string | void;

export type ReplacerMap = Partial<
    {
        [tagName in keyof HTMLElementTagNameMap]: SpecialisedReplacer<ParserElement>;
    } & {
        [Node.TEXT_NODE]: SpecialisedReplacer<Text>;
    }
>;

type PreparedReplacer = (parameters: Parameters) => Replacer;

export const combineReplacers =
    (...replacers: ReplacerMap[]): PreparedReplacer =>
    (parameters) =>
    (node, index) => {
        if (node.type === "text") {
            for (const replacer of replacers) {
                const result = replacer[Node.TEXT_NODE]?.(node, parameters, index);
                if (result) return result;
            }
        }
        if (node instanceof ParserElement) {
            const tagName = node.tagName.toLowerCase() as keyof HTMLElementTagNameMap;
            for (const replacer of replacers) {
                const result = replacer[tagName]?.(node, parameters, index);
                if (result) return result;
            }
        }
    };
