import { _t } from "../../languageHandler";

export enum exportFormats {
    HTML = "HTML",
    PLAIN_TEXT = "PLAIN_TEXT",
    JSON = "JSON",
}

export enum exportTypes {
    TIMELINE = "TIMELINE",
    BEGINNING = "BEGINNING",
    // START_DATE = "START_DATE",
    LAST_N_MESSAGES = "LAST_N_MESSAGES",
}

export const textForFormat = (format: string): string => {
    switch (format) {
        case exportFormats.HTML:
            return _t("HTML");
        case exportFormats.JSON:
            return _t("JSON");
        case exportFormats.PLAIN_TEXT:
            return _t("Plain Text");
    }
};

export const textForType = (type: string): string => {
    switch (type) {
        case exportTypes.BEGINNING:
            return _t("From the beginning");
        case exportTypes.LAST_N_MESSAGES:
            return _t("Specify a number of messages");
        case exportTypes.TIMELINE:
            return _t("Current Timeline");
        // case exportTypes.START_DATE:
        //     return _t("From a specific date");
    }
};

export interface exportOptions {
    startDate?: number;
    numberOfMessages?: number;
    attachmentsIncluded: boolean;
    maxSize: number;
}
