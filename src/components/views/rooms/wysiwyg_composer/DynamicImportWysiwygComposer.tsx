/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { ComponentProps, lazy, Suspense } from "react";
import { ISendEventResponse } from "matrix-js-sdk/src/@types/requests";

// we need to import the types for TS, but do not import the sendMessage
// function to avoid importing from "@matrix-org/matrix-wysiwyg"
import { SendMessageParams } from "./utils/message";

const SendComposer = lazy(() => import("./SendWysiwygComposer"));
const EditComposer = lazy(() => import("./EditWysiwygComposer"));

export const dynamicImportSendMessage = async (
    message: string,
    isHTML: boolean,
    params: SendMessageParams,
): Promise<ISendEventResponse | undefined> => {
    const { sendMessage } = await import("./utils/message");

    return sendMessage(message, isHTML, params);
};

export const dynamicImportConversionFunctions = async (): Promise<{
    richToPlain(rich: string): Promise<string>;
    plainToRich(plain: string): Promise<string>;
}> => {
    const { richToPlain, plainToRich } = await import("@matrix-org/matrix-wysiwyg");

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
