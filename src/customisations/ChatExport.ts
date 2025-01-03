/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ExportFormat, ExportType } from "../utils/exportUtils/exportUtils";

export type ForceChatExportParameters = {
    format?: ExportFormat;
    range?: ExportType;
    // must be < 10**8
    // only used when range is 'LastNMessages'
    // default is 100
    numberOfMessages?: number;
    includeAttachments?: boolean;
    // maximum size of exported archive
    // must be > 0 and < 8000
    sizeMb?: number;
};

/**
 * Force parameters in room chat export
 * fields returned here are forced
 * and not allowed to be edited in the chat export form
 */
const getForceChatExportParameters = (): ForceChatExportParameters => {
    return {};
};

// This interface summarises all available customisation points and also marks
// them all as optional. This allows customisers to only define and export the
// customisations they need while still maintaining type safety.
export interface IChatExportCustomisations {
    getForceChatExportParameters: typeof getForceChatExportParameters;
}

// A real customisation module will define and export one or more of the
// customisation points that make up `IChatExportCustomisations`.
export default {
    getForceChatExportParameters,
} as IChatExportCustomisations;
