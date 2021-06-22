import {MatrixEvent} from "matrix-js-sdk/src/models/event";
import {Room} from "matrix-js-sdk/src/models/room";
import {MatrixClientPeg} from "../../MatrixClientPeg";
import {exportOptions, exportTypes} from "./exportUtils";
import {decryptFile} from "../DecryptFile";
import {mediaFromContent} from "../../customisations/Media";
import {formatFullDateNoDay} from "../../DateUtils";

export default abstract class Exporter {
    protected constructor(
        protected room: Room,
        protected exportType: exportTypes,
        protected exportOptions?: exportOptions,
    ) {}

    protected setEventMetadata = (event: MatrixEvent) => {
        const client = MatrixClientPeg.get();
        const roomState = client.getRoom(this.room.roomId).currentState;
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

    protected getLimit = () => {
        let limit: number;
        switch (this.exportType) {
            case exportTypes.LAST_N_MESSAGES:
                limit = this.exportOptions.numberOfMessages;
                break;
            case exportTypes.TIMELINE:
                limit = 40;
                break;
            default:
                limit = Number.MAX_VALUE;
        }
        return limit;
    }

    protected getRequiredEvents = async () : Promise<MatrixEvent[]> => {
        const client = MatrixClientPeg.get();
        const eventMapper = client.getEventMapper();

        let prevToken: string|null = null;
        let limit = this.getLimit();
        let events: MatrixEvent[] = [];

        while (limit) {
            const eventsPerCrawl = Math.min(limit, 1000);
            const res: any = await client.createMessagesRequest(this.room.roomId, prevToken, eventsPerCrawl, "b");

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

            prevToken = res.end;
        }
        // Reverse the events so that we preserve the order
        events = events.reverse();

        const decryptionPromises = events
            .filter(event => event.isEncrypted())
            .map(event => {
                return client.decryptEventIfNeeded(event, {
                    isRetry: true,
                    emit: false,
                });
            });

        // Wait for all the events to get decrypted.
        await Promise.all(decryptionPromises);

        for (let i = 0; i < events.length; i++) this.setEventMetadata(events[i]);

        return events;
    }

    protected async getMediaBlob(event: MatrixEvent) {
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

    protected splitFileName(file: string) {
        const lastDot = file.lastIndexOf('.');
        if (lastDot === -1) return [file, ""];
        const fileName = file.slice(0, lastDot);
        const ext = file.slice(lastDot + 1);
        return [fileName, '.' + ext];
    }

    protected getFilePath(event: MatrixEvent) {
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
        const [fileName, fileExt] = this.splitFileName(event.getContent().body);
        return fileDirectory + "/" + fileName + '-' + fileDate + fileExt;
    }

    protected isReply(mxEvent) {
        const relatesTo = mxEvent.getContent()["m.relates_to"];
        return !!(relatesTo && relatesTo["m.in_reply_to"]);
    }

    protected isAttachment(mxEv: MatrixEvent) {
        const attachmentTypes = ["m.sticker", "m.image", "m.file", "m.video", "m.audio"];
        return mxEv.getType() === attachmentTypes[0] || attachmentTypes.includes(mxEv.getContent().msgtype);
    }

    abstract export(): Promise<any>;
}
