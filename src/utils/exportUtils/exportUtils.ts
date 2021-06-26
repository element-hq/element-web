import { Room } from "matrix-js-sdk/src/models/room";
import { _t } from "../../languageHandler";
import HTMLExporter from "./HtmlExport";
import JSONExporter from "./JSONExport";
import PlainTextExporter from "./PlainTextExport";

export enum exportFormats {
    HTML = "HTML",
    JSON = "JSON",
    PLAIN_TEXT = "PLAIN_TEXT",
}

export enum exportTypes {
    TIMELINE = "TIMELINE",
    BEGINNING = "BEGINNING",
    // START_DATE = "START_DATE",
    LAST_N_MESSAGES = "LAST_N_MESSAGES",
}

export const textForFormat = (format: string) => {
    switch (format) {
        case exportFormats.HTML:
            return _t("HTML");
        case exportFormats.JSON:
            return _t("JSON");
        case exportFormats.PLAIN_TEXT:
            return _t("Plain Text");
    }
}

export const textForType = (type: string) => {
    switch (type) {
        case exportTypes.BEGINNING:
            return _t("From the beginning");
        case exportTypes.LAST_N_MESSAGES:
            return _t("For a number of messages");
        case exportTypes.TIMELINE:
            return _t("Current Timeline");
        // case exportTypes.START_DATE:
        //     return _t("From a specific date");
    }
}

export interface exportOptions {
    startDate?: number;
    numberOfMessages?: number;
    attachmentsIncluded: boolean;
    maxSize: number;
}

const exportConversationalHistory = async (
    room: Room,
    format: string,
    exportType: exportTypes,
    exportOptions?: exportOptions,
) => {
    switch (format) {
        case exportFormats.HTML:
            await new HTMLExporter(room, exportType, exportOptions).export();
            break;
        case exportFormats.JSON:
            await new JSONExporter(room, exportType, exportOptions).export();
            break;
        case exportFormats.PLAIN_TEXT:
            await new PlainTextExporter(room, exportType, exportOptions).export();
            break;
    }
};

export default exportConversationalHistory;
