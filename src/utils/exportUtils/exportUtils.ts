/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { _t } from "../../languageHandler";

export enum ExportFormat {
    Html = "Html",
    PlainText = "PlainText",
    Json = "Json",
}

export type ExportFormatKey = "Html" | "PlainText" | "Json";

export enum ExportType {
    Timeline = "Timeline",
    Beginning = "Beginning",
    LastNMessages = "LastNMessages",
    // START_DATE = "START_DATE",
}

export type ExportTypeKey = "Timeline" | "Beginning" | "LastNMessages";

export const textForFormat = (format: ExportFormat): string => {
    switch (format) {
        case ExportFormat.Html:
            return _t("export_chat|html");
        case ExportFormat.Json:
            return _t("export_chat|json");
        case ExportFormat.PlainText:
            return _t("export_chat|text");
        default:
            throw new Error("Unknown format");
    }
};

export const textForType = (type: ExportType): string => {
    switch (type) {
        case ExportType.Beginning:
            return _t("export_chat|from_the_beginning");
        case ExportType.LastNMessages:
            return _t("export_chat|number_of_messages");
        case ExportType.Timeline:
            return _t("export_chat|current_timeline");
        default:
            throw new Error("Unknown type: " + type);
        // case exportTypes.START_DATE:
        //     return _t("From a specific date");
    }
};

export interface IExportOptions {
    // startDate?: number;
    numberOfMessages?: number;
    attachmentsIncluded: boolean;
    maxSize: number;
}
