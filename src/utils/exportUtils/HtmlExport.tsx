import React from "react"
import streamSaver from "streamsaver";
import JSZip from "jszip";
import { decryptFile } from "../DecryptFile";
import { mediaFromContent } from "../../customisations/Media";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { Exporter } from "./Exporter";
import * as ponyfill from "web-streams-polyfill/ponyfill"
import { renderToStaticMarkup } from 'react-dom/server'
import { Layout } from "../../settings/Layout";
import { shouldFormContinuation } from "../../components/structures/MessagePanel";
import { wantsDateSeparator } from "../../DateUtils";
import { RoomPermalinkCreator } from "../permalinks/Permalinks";
import EventTile, { haveTileForEvent } from "../../components/views/rooms/EventTile";
import DateSeparator from "../../components/views/messages/DateSeparator";
import exportCSS from "./exportCSS";
import exportJS from "./exportJS";

export default class HTMLExporter extends Exporter {
    protected zip: JSZip;
    protected avatars: Map<string, boolean>;

    constructor(res: MatrixEvent[], room: Room) {
        super(res, room);
        this.zip = new JSZip();
        this.avatars = new Map<string, boolean>();
    }

    protected wrapHTML(content: string, room: Room) {
        return `
          <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta http-equiv="X-UA-Compatible" content="IE=edge" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <link href="css/style.css" rel="stylesheet" />
                <script src="js/script.js"></script>
                <title>Exported Data</title>
            </head>
            <body style="height: 100vh;">
                <section
                id="matrixchat"
                style="height: 100%; overflow: auto"
                class="notranslate"
                >
                <div class="mx_MatrixChat_wrapper" aria-hidden="false">
                    <div class="mx_MatrixChat">
                    <main class="mx_RoomView">
                        <div class="mx_RoomHeader light-panel">
                        <div class="mx_RoomHeader_wrapper" aria-owns="mx_RightPanel">
                            <div class="mx_RoomHeader_avatar">
                            <div class="mx_DecoratedRoomAvatar">
                                <span class="mx_BaseAvatar" role="presentation"
                                ><span
                                    class="mx_BaseAvatar_initial"
                                    aria-hidden="true"
                                    style="
                                    font-size: 20.8px;
                                    width: 32px;
                                    line-height: 32px;
                                    "
                                    >G</span
                                ><img
                                    class="mx_BaseAvatar_image"
                                    alt=""
                                    aria-hidden="true"
                                    style="width: 32px; height: 32px"
                                /></span>
                            </div>
                            </div>
                            <div class="mx_RoomHeader_name">
                            <div
                                dir="auto"
                                class="mx_RoomHeader_nametext"
                                title="${room.name}"
                            >
                                ${room.name}
                            </div>
                            </div>
                            <div class="mx_RoomHeader_topic" dir="auto"></div>
                        </div>
                        </div>
                        <div class="mx_MainSplit">
                        <div class="mx_RoomView_body">
                            <div
                            class="mx_RoomView_timeline mx_RoomView_timeline_rr_enabled"
                            >
                            <div
                                class="
                                mx_AutoHideScrollbar
                                mx_ScrollPanel
                                mx_RoomView_messagePanel
                                mx_GroupLayout
                                "
                            >
                                <div class="mx_RoomView_messageListWrapper">
                                <ol
                                    class="mx_RoomView_MessageList"
                                    aria-live="polite"
                                    role="list"
                                >
                                ${content}
                                </ol>
                                </div>
                            </div>
                            </div>
                            <div class="mx_RoomView_statusArea">
                            <div class="mx_RoomView_statusAreaBox">
                                <div class="mx_RoomView_statusAreaBox_line"></div>
                            </div>
                            </div>
                        </div>
                        </div>
                    </main>
                    </div>
                </div>
                </section>
                <div id="snackbar"/>
            </body>
        </html>`
    }

    // will be used in the future
    protected async getMediaBlob(event: MatrixEvent) {
        let blob: Blob;
        try {
            const isEncrypted = event.isEncrypted();
            const content = event.getContent();
            if (isEncrypted) {
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

    protected getDateSeparator(event: MatrixEvent) {
        const ts = event.getTs();
        const dateSeparator = <li key={ts}><DateSeparator isExporting={true} key={ts} ts={ts} /></li>;
        return renderToStaticMarkup(dateSeparator);
    }

    protected _wantsDateSeparator(event: MatrixEvent, prevEvent: MatrixEvent) {
        if (prevEvent == null) return true;
        return wantsDateSeparator(prevEvent.getDate(), event.getDate());
    }

    protected async createMessageBody(mxEv: MatrixEvent, joined = false) {
        const eventTile = <li id={mxEv.getId()}>
            <EventTile
                mxEvent={mxEv}
                continuation={joined}
                isRedacted={mxEv.isRedacted()}
                replacingEventId={mxEv.replacingEventId()}
                isExporting={true}
                readReceipts={null}
                readReceiptMap={null}
                showUrlPreview={false}
                checkUnmounting={() => false}
                isTwelveHour={false}
                last={false}
                lastInSection={false}
                permalinkCreator={new RoomPermalinkCreator(this.room)}
                lastSuccessful={false}
                isSelectedEvent={false}
                getRelationsForEvent={null}
                showReactions={false}
                layout={Layout.Group}
                enableFlair={false}
                showReadReceipts={false}
            />
        </li>
        return renderToStaticMarkup(eventTile);
    }

    protected async createHTML(events: MatrixEvent[], room: Room) {
        let content = "";
        let prevEvent = null;
        for (const event of events) {
            if (!haveTileForEvent(event)) continue;

            content += this._wantsDateSeparator(event, prevEvent) ? this.getDateSeparator(event) : "";
            const shouldBeJoined = !this._wantsDateSeparator(event, prevEvent)
                                       && shouldFormContinuation(prevEvent, event);
            const body = await this.createMessageBody(event, shouldBeJoined);

            content += body;
            prevEvent = event;
        }
        return this.wrapHTML(content, room);
    }

    public async export() {
        const html = await this.createHTML(this.res, this.room);
        this.zip.file("index.html", html);
        this.zip.file("css/style.css", exportCSS);
        this.zip.file("js/script.js", exportJS);

        const filename = `matrix-export-${new Date().toISOString()}.zip`;

        //Generate the zip file asynchronously
        const blob = await this.zip.generateAsync({ type: "blob" });

        //Support for firefox browser
        streamSaver.WritableStream = ponyfill.WritableStream
        //Create a writable stream to the directory
        const fileStream = streamSaver.createWriteStream(filename, { size: blob.size });
        const writer = fileStream.getWriter();

        // Here we chunk the blob into pieces of 10 MB, the size might be dynamically generated.
        // This can be used to keep track of the progress
        const sliceSize = 10 * 1e6;
        for (let fPointer = 0; fPointer < blob.size; fPointer += sliceSize) {
            const blobPiece = blob.slice(fPointer, fPointer + sliceSize);
            const reader = new FileReader();

            const waiter = new Promise<void>((resolve, reject) => {
                reader.onloadend = evt => {
                    const arrayBufferNew: any = evt.target.result;
                    const uint8ArrayNew = new Uint8Array(arrayBufferNew);
                    writer.write(uint8ArrayNew);
                    resolve();
                };
                reader.readAsArrayBuffer(blobPiece);
            });
            await waiter;
        }
        writer.close();

        return blob;
    }
}

