/*
Copyright 2021 - 2022 The Matrix.org Foundation C.I.C.

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

import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { Room } from "matrix-js-sdk/src/models/room";
import { Direction } from "matrix-js-sdk/src/models/event-timeline";
import { saveAs } from "file-saver";
import { logger } from "matrix-js-sdk/src/logger";
import sanitizeFilename from "sanitize-filename";

import { ExportType, IExportOptions } from "./exportUtils";
import { decryptFile } from "../DecryptFile";
import { mediaFromContent } from "../../customisations/Media";
import { formatFullDateNoDay, formatFullDateNoDayISO } from "../../DateUtils";
import { isVoiceMessage } from "../EventUtils";
import { IMediaEventContent } from "../../customisations/models/IMediaEventContent";
import { _t } from "../../languageHandler";
import SdkConfig from "../../SdkConfig";

type BlobFile = {
    name: string;
    blob: Blob;
};

export default abstract class Exporter {
    protected files: BlobFile[] = [];
    protected cancelled = false;

    protected constructor(
        protected room: Room,
        protected exportType: ExportType,
        protected exportOptions: IExportOptions,
        protected setProgressText: React.Dispatch<React.SetStateAction<string>>,
    ) {
        if (
            exportOptions.maxSize < 1 * 1024 * 1024 || // Less than 1 MB
            exportOptions.maxSize > 8000 * 1024 * 1024 || // More than 8 GB
            (!!exportOptions.numberOfMessages && exportOptions.numberOfMessages > 10 ** 8) ||
            (exportType === ExportType.LastNMessages && !exportOptions.numberOfMessages)
        ) {
            throw new Error("Invalid export options");
        }
        window.addEventListener("beforeunload", this.onBeforeUnload);
    }

    public get destinationFileName(): string {
        return this.makeFileNameNoExtension(SdkConfig.get().brand) + ".zip";
    }

    protected onBeforeUnload(e: BeforeUnloadEvent): string {
        e.preventDefault();
        return (e.returnValue = _t("Are you sure you want to exit during this export?"));
    }

    protected updateProgress(progress: string, log = true, show = true): void {
        if (log) logger.log(progress);
        if (show) this.setProgressText(progress);
    }

    protected addFile(filePath: string, blob: Blob): void {
        const file = {
            name: filePath,
            blob,
        };
        this.files.push(file);
    }

    protected makeFileNameNoExtension(brand = "matrix"): string {
        // First try to use the real name of the room, then a translated copy of a generic name,
        // then finally hardcoded default to guarantee we'll have a name.
        const safeRoomName = sanitizeFilename(this.room.name ?? _t("Unnamed Room")).trim() || "Unnamed Room";
        const safeDate = formatFullDateNoDayISO(new Date()).replace(/:/g, "-"); // ISO format automatically removes a lot of stuff for us
        const safeBrand = sanitizeFilename(brand);
        return `${safeBrand} - ${safeRoomName} - Chat Export - ${safeDate}`;
    }

    protected async downloadZIP(): Promise<string | void> {
        const filename = this.destinationFileName;
        const filenameWithoutExt = filename.substring(0, filename.lastIndexOf(".")); // take off the extension
        const { default: JSZip } = await import("jszip");

        const zip = new JSZip();
        // Create a writable stream to the directory
        if (!this.cancelled) this.updateProgress(_t("Generating a ZIP"));
        else return this.cleanUp();

        for (const file of this.files) zip.file(filenameWithoutExt + "/" + file.name, file.blob);

        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, filenameWithoutExt + ".zip");
    }

    protected cleanUp(): string {
        logger.log("Cleaning up...");
        window.removeEventListener("beforeunload", this.onBeforeUnload);
        return "";
    }

    public async cancelExport(): Promise<void> {
        logger.log("Cancelling export...");
        this.cancelled = true;
    }

    protected downloadPlainText(fileName: string, text: string): void {
        const content = new Blob([text], { type: "text/plain" });
        saveAs(content, fileName);
    }

    protected setEventMetadata(event: MatrixEvent): MatrixEvent {
        const roomState = this.room.currentState;
        const sender = event.getSender();
        event.sender = (!!sender && roomState?.getSentinelMember(sender)) || null;
        if (event.getType() === "m.room.member") {
            event.target = roomState?.getSentinelMember(event.getStateKey()!) ?? null;
        }
        return event;
    }

    public getLimit(): number {
        let limit: number;
        switch (this.exportType) {
            case ExportType.LastNMessages:
                // validated in constructor that numberOfMessages is defined
                // when export type is LastNMessages
                limit = this.exportOptions.numberOfMessages!;
                break;
            case ExportType.Timeline:
                limit = 40;
                break;
            default:
                limit = 10 ** 8;
        }
        return limit;
    }

    protected async getRequiredEvents(): Promise<MatrixEvent[]> {
        const eventMapper = this.room.client.getEventMapper();

        let prevToken: string | null = null;
        let limit = this.getLimit();
        const events: MatrixEvent[] = [];

        while (limit) {
            const eventsPerCrawl = Math.min(limit, 1000);
            const res = await this.room.client.createMessagesRequest(
                this.room.roomId,
                prevToken,
                eventsPerCrawl,
                Direction.Backward,
            );

            if (this.cancelled) {
                this.cleanUp();
                return [];
            }

            if (res.chunk.length === 0) break;

            limit -= res.chunk.length;

            const matrixEvents: MatrixEvent[] = res.chunk.map(eventMapper);

            for (const mxEv of matrixEvents) {
                // if (this.exportOptions.startDate && mxEv.getTs() < this.exportOptions.startDate) {
                //     // Once the last message received is older than the start date, we break out of both the loops
                //     limit = 0;
                //     break;
                // }
                events.push(mxEv);
            }

            if (this.exportType === ExportType.LastNMessages) {
                this.updateProgress(
                    _t("Fetched %(count)s events out of %(total)s", {
                        count: events.length,
                        total: this.exportOptions.numberOfMessages,
                    }),
                );
            } else {
                this.updateProgress(
                    _t("Fetched %(count)s events so far", {
                        count: events.length,
                    }),
                );
            }

            prevToken = res.end ?? null;
        }
        // Reverse the events so that we preserve the order
        for (let i = 0; i < Math.floor(events.length / 2); i++) {
            [events[i], events[events.length - i - 1]] = [events[events.length - i - 1], events[i]];
        }

        const decryptionPromises = events
            .filter((event) => event.isEncrypted())
            .map((event) => {
                return this.room.client.decryptEventIfNeeded(event, {
                    isRetry: true,
                    emit: false,
                });
            });

        // Wait for all the events to get decrypted.
        await Promise.all(decryptionPromises);

        for (let i = 0; i < events.length; i++) this.setEventMetadata(events[i]);

        return events;
    }

    /**
     * Decrypts if necessary, and fetches media from a matrix event
     * @param event - matrix event with media event content
     * @resolves when media has been fetched
     * @throws if media was unable to be fetched
     */
    protected async getMediaBlob(event: MatrixEvent): Promise<Blob> {
        let blob: Blob | undefined = undefined;
        try {
            const isEncrypted = event.isEncrypted();
            const content = event.getContent<IMediaEventContent>();
            const shouldDecrypt = isEncrypted && content.hasOwnProperty("file") && event.getType() !== "m.sticker";
            if (shouldDecrypt) {
                blob = await decryptFile(content.file);
            } else {
                const media = mediaFromContent(content);
                if (!media.srcHttp) {
                    throw new Error("Cannot fetch without srcHttp");
                }
                const image = await fetch(media.srcHttp);
                blob = await image.blob();
            }
        } catch (err) {
            logger.log("Error decrypting media");
        }
        if (!blob) {
            throw new Error("Unable to fetch file");
        }
        return blob;
    }

    public splitFileName(file: string): string[] {
        const lastDot = file.lastIndexOf(".");
        if (lastDot === -1) return [file, ""];
        const fileName = file.slice(0, lastDot);
        const ext = file.slice(lastDot + 1);
        return [fileName, "." + ext];
    }

    public getFilePath(event: MatrixEvent): string {
        const mediaType = event.getContent().msgtype;
        let fileDirectory: string;
        switch (mediaType) {
            case "m.image":
                fileDirectory = "images";
                break;
            case "m.video":
                fileDirectory = "videos";
                break;
            case "m.audio":
                fileDirectory = "audio";
                break;
            default:
                fileDirectory = event.getType() === "m.sticker" ? "stickers" : "files";
        }
        const fileDate = formatFullDateNoDay(new Date(event.getTs()));
        let [fileName, fileExt] = this.splitFileName(event.getContent().body);

        if (event.getType() === "m.sticker") fileExt = ".png";
        if (isVoiceMessage(event)) fileExt = ".ogg";

        return fileDirectory + "/" + fileName + "-" + fileDate + fileExt;
    }

    protected isReply(event: MatrixEvent): boolean {
        const isEncrypted = event.isEncrypted();
        // If encrypted, in_reply_to lies in event.event.content
        const content = isEncrypted ? event.event.content! : event.getContent();
        const relatesTo = content["m.relates_to"];
        return !!(relatesTo && relatesTo["m.in_reply_to"]);
    }

    protected isAttachment(mxEv: MatrixEvent): boolean {
        const attachmentTypes = ["m.sticker", "m.image", "m.file", "m.video", "m.audio"];
        return mxEv.getType() === attachmentTypes[0] || attachmentTypes.includes(mxEv.getContent().msgtype!);
    }

    public abstract export(): Promise<void>;
}
