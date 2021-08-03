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

export enum ExportFormats {
    HTML = "HTML",
    PLAIN_TEXT = "PLAIN_TEXT",
    JSON = "JSON",
}

export enum ExportTypes {
    TIMELINE = "TIMELINE",
    BEGINNING = "BEGINNING",
    LAST_N_MESSAGES = "LAST_N_MESSAGES",
    // START_DATE = "START_DATE",
}

export const textForFormat = (format: string): string => {
    switch (format) {
        case ExportFormats.HTML:
            return _t("HTML");
        case ExportFormats.JSON:
            return _t("JSON");
        case ExportFormats.PLAIN_TEXT:
            return _t("Plain Text");
        default:
            throw new Error("Unknown format");
    }
};

export const textForType = (type: string): string => {
    switch (type) {
        case ExportTypes.BEGINNING:
            return _t("From the beginning");
        case ExportTypes.LAST_N_MESSAGES:
            return _t("Specify a number of messages");
        case ExportTypes.TIMELINE:
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
