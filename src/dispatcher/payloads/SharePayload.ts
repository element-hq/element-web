/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ActionPayload } from "../payloads";
import { type Action } from "../actions";

export enum ShareFormat {
    Text = "text",
    Html = "html",
    Markdown = "md",
}

export interface SharePayload extends ActionPayload {
    action: Action.Share;

    /**
     * The format of message to be shared (optional)
     */
    format: ShareFormat;

    /**
     * The message to be shared.
     */
    msg: string;
}
