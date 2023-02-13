/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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
            return _t("HTML");
        case ExportFormat.Json:
            return _t("JSON");
        case ExportFormat.PlainText:
            return _t("Plain Text");
        default:
            throw new Error("Unknown format");
    }
};

export const textForType = (type: ExportType): string => {
    switch (type) {
        case ExportType.Beginning:
            return _t("From the beginning");
        case ExportType.LastNMessages:
            return _t("Specify a number of messages");
        case ExportType.Timeline:
            return _t("Current Timeline");
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
