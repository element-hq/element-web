/*
Copyright 2024 New Vector Ltd.
Copyright 2021, 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room, type IEvent, type MatrixEvent, EventType } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import Exporter from "./Exporter";
import { formatFullDateNoDayNoTime } from "../../DateUtils";
import { type ExportType, type IExportOptions } from "./exportUtils";
import { _t } from "../../languageHandler";
import { haveRendererForEvent } from "../../events/EventTileFactory";

export default class JSONExporter extends Exporter {
    protected totalSize = 0;
    protected messages: Record<string, any>[] = [];

    public constructor(
        room: Room,
        exportType: ExportType,
        exportOptions: IExportOptions,
        setProgressText: React.Dispatch<React.SetStateAction<string>>,
    ) {
        super(room, exportType, exportOptions, setProgressText);
    }

    public get destinationFileName(): string {
        return this.makeFileNameNoExtension() + ".json";
    }

    protected createJSONString(): string {
        const exportDate = formatFullDateNoDayNoTime(new Date());
        const creator = this.room.currentState.getStateEvents(EventType.RoomCreate, "")?.getSender();
        const creatorName = (creator && this.room?.getMember(creator)?.rawDisplayName) || creator;
        const topic = this.room.currentState.getStateEvents(EventType.RoomTopic, "")?.getContent()?.topic || "";
        const exporter = this.room.client.getUserId()!;
        const exporterName = this.room?.getMember(exporter)?.rawDisplayName || exporter;
        const jsonObject = {
            room_name: this.room.name,
            room_creator: creatorName,
            topic,
            export_date: exportDate,
            exported_by: exporterName,
            messages: this.messages,
        };
        return JSON.stringify(jsonObject, null, 2);
    }

    protected async getJSONString(mxEv: MatrixEvent): Promise<IEvent> {
        if (this.exportOptions.attachmentsIncluded && this.isAttachment(mxEv)) {
            try {
                const blob = await this.getMediaBlob(mxEv);
                if (this.totalSize + blob.size < this.exportOptions.maxSize) {
                    this.totalSize += blob.size;
                    const filePath = this.getFilePath(mxEv);
                    if (this.totalSize == this.exportOptions.maxSize) {
                        this.exportOptions.attachmentsIncluded = false;
                    }
                    this.addFile(filePath, blob);
                }
            } catch (err) {
                logger.log("Error fetching file: " + err);
            }
        }
        return mxEv.getEffectiveEvent();
    }

    protected async createOutput(events: MatrixEvent[]): Promise<string> {
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
            this.messages.push(await this.getJSONString(event));
        }
        return this.createJSONString();
    }

    public async export(): Promise<void> {
        logger.info("Starting export process...");
        logger.info("Fetching events...");

        const fetchStart = performance.now();
        const res = await this.getRequiredEvents();
        const fetchEnd = performance.now();

        logger.log(`Fetched ${res.length} events in ${(fetchEnd - fetchStart) / 1000}s`);

        logger.info("Creating output...");
        const text = await this.createOutput(res);

        if (this.files.length) {
            this.addFile("export.json", new Blob([text]));
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
