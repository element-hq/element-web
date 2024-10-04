/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { ComponentProps, lazy, Suspense } from "react";
import { ISendEventResponse } from "matrix-js-sdk/src/matrix";

// we need to import the types for TS, but do not import the sendMessage
// function to avoid importing from "@matrix-org/matrix-wysiwyg"
import { SendMessageParams } from "./utils/message";
import { retry } from "../../../../utils/promise";

// Due to issues such as https://github.com/vector-im/element-web/issues/25277, we add retry
// attempts to all of the dynamic imports in this file
const RETRY_COUNT = 3;
const SendComposer = lazy(() => retry(() => import("./SendWysiwygComposer"), RETRY_COUNT));
const EditComposer = lazy(() => retry(() => import("./EditWysiwygComposer"), RETRY_COUNT));

export const dynamicImportSendMessage = async (
    message: string,
    isHTML: boolean,
    params: SendMessageParams,
): Promise<ISendEventResponse | undefined> => {
    const { sendMessage } = await retry(() => import("./utils/message"), RETRY_COUNT);

    return sendMessage(message, isHTML, params);
};

export const dynamicImportConversionFunctions = async (): Promise<{
    /**
     * Creates a rust model from rich text input (html) and uses it to generate the plain text equivalent (which may
     * contain markdown). The return value must be used to set `.innerHTML` (rather than `.innerText`) to
     * ensure that HTML entities are correctly interpreted, and to prevent newline characters being turned into `<br>`.
     *
     * @param rich - html to convert
     * @param inMessageFormat - `true` to format the return value for use as a message `formatted_body`.
     * `false` to format it for writing to an editor element.
     * @returns a string of plain text that may contain markdown
     */
    richToPlain(rich: string, inMessageFormat: boolean): Promise<string>;

    /**
     * Creates a rust model from plain text input (interpreted as markdown) and uses it to generate the rich text
     * equivalent. Output can be formatted for display in the composer or for sending in a Matrix message.
     *
     * @param plain - plain text to convert. Note: when reading the plain text from the editor element, be sure to
     * use `.innerHTML` (rather than `.innerText`) to ensure that punctuation characters are correctly HTML-encoded.
     * @param inMessageFormat - `true` to format the return value for use as a message `formatted_body`.
     * `false` to format it for writing to an editor element.
     * @returns a string of html
     */
    plainToRich(plain: string, inMessageFormat: boolean): Promise<string>;
}> => {
    const { richToPlain, plainToRich } = await retry(() => import("@matrix-org/matrix-wysiwyg"), RETRY_COUNT);

    return { richToPlain, plainToRich };
};

export function DynamicImportSendWysiwygComposer(props: ComponentProps<typeof SendComposer>): JSX.Element {
    return (
        <Suspense fallback={<div />}>
            <SendComposer {...props} />
        </Suspense>
    );
}

export function DynamicImportEditWysiwygComposer(props: ComponentProps<typeof EditComposer>): JSX.Element {
    return (
        <Suspense fallback={<div />}>
            <EditComposer {...props} />
        </Suspense>
    );
}
