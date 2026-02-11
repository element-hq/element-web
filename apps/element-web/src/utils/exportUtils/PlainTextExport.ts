/*
Copyright 2024 New Vector Ltd.
Copyright 2021, 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room, type IContent, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import type React from "react";
import Exporter from "./Exporter";
import { _t } from "../../languageHandler";
import { type ExportType, type IExportOptions } from "./exportUtils";
import { textForEvent } from "../../TextForEvent";
import { haveRendererForEvent } from "../../events/EventTileFactory";
import SettingsStore from "../../settings/SettingsStore";
import { formatFullDate } from "../../DateUtils";

export default class PlainTextExporter extends Exporter {
    protected totalSize: number;
    protected mediaOmitText: string;

    public constructor(
        room: Room,
        exportType: ExportType,
        exportOptions: IExportOptions,
        setProgressText: React.Dispatch<React.SetStateAction<string>>,
    ) {
        super(room, exportType, exportOptions, setProgressText);
        this.totalSize = 0;
        this.mediaOmitText = !this.exportOptions.attachmentsIncluded
            ? _t("export_chat|media_omitted")
            : _t("export_chat|media_omitted_file_size");
    }

    public get destinationFileName(): string {
        return this.makeFileNameNoExtension() + ".txt";
    }

    public textForReplyEvent = (content: IContent): string => {
        const REPLY_REGEX = /> <(.*?)>(.*?)\n\n(.*)/s;
        const REPLY_SOURCE_MAX_LENGTH = 32;

        const match = REPLY_REGEX.exec(content.body);

        // if the reply format is invalid, then return the body
        if (!match) return content.body;

        let rplSource: string;
        const rplName = match[1];
        const rplText = match[3];

        rplSource = match[2].substring(1);
        // Get the first non-blank line from the source.
        const lines = rplSource.split("\n").filter((line) => !/^\s*$/.test(line));
        if (lines.length > 0) {
            // Cut to a maximum length.
            rplSource = lines[0].substring(0, REPLY_SOURCE_MAX_LENGTH);
            // Ellipsis if needed.
            if (lines[0].length > REPLY_SOURCE_MAX_LENGTH) {
                rplSource = rplSource + "...";
            }
            // Wrap in formatting
            rplSource = ` "${rplSource}"`;
        } else {
            // Don't show a source because we couldn't format one.
            rplSource = "";
        }

        return `<${rplName}${rplSource}> ${rplText}`;
    };

    protected plainTextForEvent = async (mxEv: MatrixEvent): Promise<string> => {
        const senderDisplayName = mxEv.sender && mxEv.sender.name ? mxEv.sender.name : mxEv.getSender();
        let mediaText = "";
        if (this.isAttachment(mxEv)) {
            if (this.exportOptions.attachmentsIncluded) {
                try {
                    const blob = await this.getMediaBlob(mxEv);
                    if (this.totalSize + blob.size > this.exportOptions.maxSize) {
                        mediaText = ` (${this.mediaOmitText})`;
                    } else {
                        this.totalSize += blob.size;
                        const filePath = this.getFilePath(mxEv);
                        mediaText = " (" + _t("export_chat|file_attached") + ")";
                        this.addFile(filePath, blob);
                        if (this.totalSize == this.exportOptions.maxSize) {
                            this.exportOptions.attachmentsIncluded = false;
                        }
                    }
                } catch (error) {
                    mediaText = " (" + _t("export_chat|error_fetching_file") + ")";
                    logger.log("Error fetching file " + error);
                }
            } else mediaText = ` (${this.mediaOmitText})`;
        }
        if (this.isReply(mxEv)) return senderDisplayName + ": " + this.textForReplyEvent(mxEv.getContent()) + mediaText;
        else return textForEvent(mxEv, this.room.client) + mediaText;
    };

    protected async createOutput(events: MatrixEvent[]): Promise<string> {
        let content = "";
        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            this.updateProgress(
                _t("export_chat|processing_event_n", {
                    number: i + 1,
                    total: events.length,
                }),
                false,
                true,
            );
            if (this.cancelled) return this.cleanUp();
            if (!haveRendererForEvent(event, this.room.client, false)) continue;
            const textForEvent = await this.plainTextForEvent(event);
            content +=
                textForEvent &&
                `${formatFullDate(
                    new Date(event.getTs()),
                    SettingsStore.getValue("showTwelveHourTimestamps"),
                )} - ${textForEvent}\n`;
        }
        return content;
    }

    public async export(): Promise<void> {
        this.updateProgress(_t("export_chat|starting_export"));
        this.updateProgress(_t("export_chat|fetching_events"));

        const fetchStart = performance.now();
        const res = await this.getRequiredEvents();
        const fetchEnd = performance.now();

        logger.log(`Fetched ${res.length} events in ${(fetchEnd - fetchStart) / 1000}s`);

        this.updateProgress(_t("export_chat|creating_output"));
        const text = await this.createOutput(res);

        if (this.files.length) {
            this.addFile("export.txt", new Blob([text]));
            await this.downloadZIP();
        } else {
            const fileName = this.destinationFileName;
            this.downloadPlainText(fileName, text);
        }

        const exportEnd = performance.now();

        if (this.cancelled) {
            logger.info("Export cancelled successfully");
        } else {
            logger.info("Export successful!");
            logger.log(`Exported ${res.length} events in ${(exportEnd - fetchStart) / 1000} seconds`);
        }

        this.cleanUp();
    }
}
