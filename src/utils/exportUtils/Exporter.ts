import streamSaver from "streamsaver";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { exportOptions, exportTypes } from "./exportUtils";
import { decryptFile } from "../DecryptFile";
import { mediaFromContent } from "../../customisations/Media";
import { formatFullDateNoDay } from "../../DateUtils";
import { Direction, MatrixClient } from "matrix-js-sdk";
import streamToZIP from "./ZipStream";
import * as ponyfill from "web-streams-polyfill/ponyfill";
import "web-streams-polyfill/ponyfill"; // to support streams API for older browsers
import { MutableRefObject } from "react";

type FileStream = {
    name: string;
    stream(): ReadableStream;
};

export default abstract class Exporter {
    protected files: FileStream[];
    protected client: MatrixClient;
    protected writer: WritableStreamDefaultWriter<any>;
    protected fileStream: WritableStream<any>;
    protected cancelled: boolean;

    protected constructor(
        protected room: Room,
        protected exportType: exportTypes,
        protected exportOptions: exportOptions,
        protected exportProgressRef: MutableRefObject<HTMLParagraphElement>,
    ) {
        this.cancelled = false;
        this.files = [];
        this.client = MatrixClientPeg.get();
        window.addEventListener("beforeunload", this.onBeforeUnload);
        window.addEventListener("onunload", this.abortWriter);
    }

    protected onBeforeUnload(e: BeforeUnloadEvent): string {
        e.preventDefault();
        return e.returnValue = "Are you sure you want to exit during this export?";
    }

    protected updateProgress(progress: string, log = true, show = true): void {
        if (log) console.log(progress);
        if (show) this.exportProgressRef.current.innerText = progress;
    }

    protected addFile(filePath: string, blob: Blob): void {
        const file = {
            name: filePath,
            stream: () => blob.stream(),
        };
        this.files.push(file);
    }

    protected async downloadZIP(): Promise<any> {
        const filename = `matrix-export-${formatFullDateNoDay(new Date())}.zip`;

        // Support for older browsers
        streamSaver.WritableStream = ponyfill.WritableStream;

        // Create a writable stream to the directory
        this.fileStream = streamSaver.createWriteStream(filename);

        if (!this.cancelled) this.updateProgress("Generating a ZIP...");
        else return this.cleanUp();

        this.writer = this.fileStream.getWriter();
        const files = this.files;

        const readableZipStream = streamToZIP({
            start(ctrl) {
                for (const file of files) ctrl.enqueue(file);
                ctrl.close();
            },
        });

        if (this.cancelled) return this.cleanUp();

        this.updateProgress("Writing to the file system...");

        const reader = readableZipStream.getReader();
        await this.pumpToFileStream(reader);
    }

    protected cleanUp(): string {
        console.log("Cleaning up...");
        window.removeEventListener("beforeunload", this.onBeforeUnload);
        window.removeEventListener("onunload", this.abortWriter);
        return "";
    }

    public async cancelExport(): Promise<void> {
        console.log("Cancelling export...");
        this.cancelled = true;
        await this.abortWriter();
    }

    protected async downloadPlainText(fileName: string, text: string): Promise<any> {
        this.fileStream = streamSaver.createWriteStream(fileName);
        this.writer = this.fileStream.getWriter();
        const data = new TextEncoder().encode(text);
        if (this.cancelled) return this.cleanUp();
        await this.writer.write(data);
        await this.writer.close();
    }

    protected async abortWriter(): Promise<void> {
        await this.fileStream?.abort();
        await this.writer?.abort();
    }

    protected async pumpToFileStream(reader: ReadableStreamDefaultReader): Promise<void> {
        const res = await reader.read();
        if (res.done) await this.writer.close();
        else {
            await this.writer.write(res.value);
            await this.pumpToFileStream(reader);
        }
    }

    protected setEventMetadata(event: MatrixEvent): MatrixEvent {
        const roomState = this.client.getRoom(this.room.roomId).currentState;
        event.sender = roomState.getSentinelMember(
            event.getSender(),
        );
        if (event.getType() === "m.room.member") {
            event.target = roomState.getSentinelMember(
                event.getStateKey(),
            );
        }
        return event;
    }

    protected getLimit(): number {
        let limit: number;
        switch (this.exportType) {
            case exportTypes.LAST_N_MESSAGES:
                limit = this.exportOptions.numberOfMessages;
                break;
            case exportTypes.TIMELINE:
                limit = 40;
                break;
            default:
                limit = 10**8;
        }
        return limit;
    }

    protected async getRequiredEvents(): Promise<MatrixEvent[]> {
        const eventMapper = this.client.getEventMapper();

        let prevToken: string|null = null;
        let limit = this.getLimit();
        const events: MatrixEvent[] = [];

        while (limit) {
            const eventsPerCrawl = Math.min(limit, 1000);
            const res: any = await this.client.createMessagesRequest(this.room.roomId, prevToken, eventsPerCrawl, Direction.Backward);

            if (this.cancelled) {
                this.cleanUp();
                return [];
            }

            if (res.chunk.length === 0) break;

            limit -= res.chunk.length;

            const matrixEvents: MatrixEvent[] = res.chunk.map(eventMapper);

            for (const mxEv of matrixEvents) {
                if (this.exportOptions.startDate && mxEv.getTs() < this.exportOptions.startDate) {
                    // Once the last message received is older than the start date, we break out of both the loops
                    limit = 0;
                    break;
                }
                events.push(mxEv);
            }
            this.updateProgress(
                ("Fetched " + events.length + " events ") + (this.exportType === exportTypes.LAST_N_MESSAGES
                    ? `out of ${this.exportOptions.numberOfMessages}...`
                    : "so far..."),
            );
            prevToken = res.end;
        }
        // Reverse the events so that we preserve the order
        for (let i = 0; i < Math.floor(events.length/2); i++) {
            [events[i], events[events.length - i - 1]] = [events[events.length - i - 1], events[i]];
        }

        const decryptionPromises = events
            .filter(event => event.isEncrypted())
            .map(event => {
                return this.client.decryptEventIfNeeded(event, {
                    isRetry: true,
                    emit: false,
                });
            });

        // Wait for all the events to get decrypted.
        await Promise.all(decryptionPromises);

        for (let i = 0; i < events.length; i++) this.setEventMetadata(events[i]);

        return events;
    }

    protected async getMediaBlob(event: MatrixEvent): Promise<Blob> {
        let blob: Blob;
        try {
            const isEncrypted = event.isEncrypted();
            const content = event.getContent();
            const shouldDecrypt = isEncrypted && !content.hasOwnProperty("org.matrix.msc1767.file")
                && event.getType() !== "m.sticker";
            if (shouldDecrypt) {
                blob = await decryptFile(content.file);
            } else {
                const media = mediaFromContent(event.getContent());
                const image = await fetch(media.srcHttp);
                blob = await image.blob();
            }
        } catch (err) {
            console.log("Error decrypting media");
        }
        return blob;
    }

    protected splitFileName(file: string): string[] {
        const lastDot = file.lastIndexOf('.');
        if (lastDot === -1) return [file, ""];
        const fileName = file.slice(0, lastDot);
        const ext = file.slice(lastDot + 1);
        return [fileName, '.' + ext];
    }

    protected getFilePath(event: MatrixEvent): string {
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
        return fileDirectory + "/" + fileName + '-' + fileDate + fileExt;
    }

    protected isReply(event: MatrixEvent): boolean {
        const isEncrypted = event.isEncrypted();
        // If encrypted, in_reply_to lies in event.event.content
        const content = isEncrypted ? event.event.content : event.getContent();
        const relatesTo = content["m.relates_to"];
        return !!(relatesTo && relatesTo["m.in_reply_to"]);
    }

    protected isAttachment(mxEv: MatrixEvent): boolean {
        const attachmentTypes = ["m.sticker", "m.image", "m.file", "m.video", "m.audio"];
        return mxEv.getType() === attachmentTypes[0] || attachmentTypes.includes(mxEv.getContent().msgtype);
    }

    abstract export(): Promise<any>;
}
