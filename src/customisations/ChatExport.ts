/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ChatExportCustomisations } from "@element-hq/element-web-module-api";

import { type ExportFormat, type ExportType } from "../utils/exportUtils/exportUtils";

export type ForceChatExportParameters = ReturnType<
    ChatExportCustomisations<ExportFormat, ExportType>["getForceChatExportParameters"]
>;

/**
 * Force parameters in room chat export
 * fields returned here are forced
 * and not allowed to be edited in the chat export form
 */
const getForceChatExportParameters = (): ForceChatExportParameters => {
    return {};
};

// A real customisation module will define and export one or more of the
// customisation points that make up `IChatExportCustomisations`.
export default {
    getForceChatExportParameters,
} as ChatExportCustomisations<ExportFormat, ExportType>;
