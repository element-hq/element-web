import { Room } from "matrix-js-sdk/src/models/room";
import { _t } from "../../languageHandler";
import HTMLExporter from "./HtmlExport";
import JSONExporter from "./JSONExport";
import PlainTextExporter from "./PlainTextExport";

_t("HTML");
_t("JSON");
_t("Plain Text");

export enum exportFormats {
    HTML = "HTML",
    JSON = "JSON",
    PLAIN_TEXT = "Plain Text",
}

_t("Current Timeline");
_t("From the beginning")
_t("From a specific date")
_t("Last n messages");

export enum exportTypes {
    TIMELINE = "Current Timeline",
    BEGINNING = "From the beginning",
    START_DATE = "From a specific date",
    LAST_N_MESSAGES = "Last n messages",
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
