import streamSaver from "streamsaver";
import JSZip from "jszip";
import { decryptFile } from "../DecryptFile";
import { mediaFromContent, mediaFromMxc } from "../../customisations/Media";
import { textForEvent } from "../../TextForEvent";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { getUserNameColorClass } from "../FormattingUtils";
import { Exporter } from "./Exporter";
import * as ponyfill from "web-streams-polyfill/ponyfill"
import { sanitizeHtmlParams } from "../../HtmlUtils";
import sanitizeHtml from "sanitize-html";

const css = `
body {
    margin: 0;
    font: 12px/18px 'Inter', 'Open Sans',"Lucida Grande","Lucida Sans Unicode",Arial,Helvetica,Verdana,sans-serif;
}

.mx_clearfix:after {
    content: " ";
    visibility: hidden;
    display: block;
    height: 0;
    clear: both;
}

.mx_pull_left {
    float: left;
}

.mx_pull_right {
    float: right;
}

.mx_page_wrap {
    background-color: #ffffff;
    color: #000000;
}

.mx_page_wrap a {
    color: #168acd;
    text-decoration: none;
}

.mx_page_wrap a:hover {
    text-decoration: underline;
}

.mx_page_header {
    position: fixed;
    z-index: 10;
    background-color: #ffffff;
    width: 100%;
    border-bottom: 1px solid #e3e6e8;
}

.mx_page_header .mx_content {
    width: 480px;
    margin: 0 auto;
    border-radius: 0 !important;
}

.mx_page_header a.mx_content {
    background-repeat: no-repeat;
    background-position: 24px 21px;
    background-size: 24px 24px;
}

.mx_bold {
    color: #212121;
    font-weight: 700;
}

.mx_details {
    color: #70777b;
}

.mx_page_header .mx_content .mx_text {
    padding: 24px 24px 22px 24px;
    font-size: 22px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
}

.mx_page_header a.mx_content .mx_text {
    padding: 24px 24px 22px 82px;
}

.mx_page_body {
    padding-top: 64px;
    width: 700px;
    margin: 0 auto;
}

.mx_userpic {
    display: block;
    border-radius: 50%;
    overflow: hidden;
}

.mx_userpic .mx_initials {
    display: block;
    color: #fff;
    text-align: center;
    text-transform: uppercase;
    user-select: none;
}

a.mx_block_link {
    display: block;
    text-decoration: none !important;
    border-radius: 4px;
}

a.mx_block_link:hover {
    text-decoration: none !important;
    background-color: #f5f7f8;
}

.mx_history {
    padding: 16px 0;
}

.mx_message {
    margin: 0 -10px;
    transition: background-color 2.0s ease;
}

div.mx_selected {
    background-color: rgba(242,246,250,255);
    transition: background-color 0.5s ease;
}

.mx_service {
    padding: 10px 24px;
}

.mx_service .mx_body {
    text-align: center;
}

.mx_message .mx_userpic .mx_initials {
    font-size: 16px;
}

.mx_default {
    padding: 10px;
}

.mx_default.mx_joined {
    margin-top: -10px;
}

.mx_default .mx_from_name {
    font-weight: 700;
    padding-bottom: 5px;
}

.mx_default .mx_body {
    margin-left: 60px;
}

.mx_default .mx_text {
    word-wrap: break-word;
    line-height: 150%;
}

.mx_default .mx_reply_to,
.mx_default .mx_media_wrap {
    padding-bottom: 5px;
}

.mx_default .mx_media {
    margin: 0 -10px;
    padding: 5px 10px;
}

.mx_default .mx_media .mx_fill,
.mx_default .mx_media .mx_thumb {
    width: 48px;
    height: 48px;
    border-radius: 50%;
}

.mx_default .mx_media .mx_fill {
    background-repeat: no-repeat;
    background-position: 12px 12px;
    background-size: 24px 24px;
}

.mx_default .mx_media .mx_title {
    padding-top: 4px;
    font-size: 14px;
}

.mx_default .mx_media .mx_description {
    color: #000000;
    padding-top: 4px;
    font-size: 13px;
}

.mx_default .mx_media .mx_status {
    padding-top: 4px;
    font-size: 13px;
}

.mx_default .mx_photo {
    display: block;
}

.mx_from_name.mx_Username_color1{
    color: #368bd6;
}

.mx_initials_wrap.mx_Username_color1{
    background-color: #368bd6;
}

.mx_from_name.mx_Username_color2{
    color: #ac3ba8;
}

.mx_initials_wrap.mx_Username_color2{
    background-color: #ac3ba8;
}

.mx_from_name.mx_Username_color3{
    color: #03b381;
}

.mx_initials_wrap.mx_Username_color3{
    background-color: #03b381;
}

.mx_from_name.mx_Username_color4{
    color: #e64f7a;
}

.mx_initials_wrap.mx_Username_color4{
    background-color: #e64f7a;
}

.mx_from_name.mx_Username_color5{
    color: #ff812d;
}

.mx_initials_wrap.mx_Username_color5{
    background-color: #ff812d;
}

.mx_from_name.mx_Username_color6{
    color: #2dc2c5;
}

.mx_initials_wrap.mx_Username_color6{
    background-color: #2dc2c5;
}

.mx_from_name.mx_Username_color7{
    color: #5c56f5;
}

.mx_initials_wrap.mx_Username_color7{
    background-color: #5c56f5;
}

.mx_from_name.mx_Username_color8{
    color: #74d12c;
}

.mx_initials_wrap.mx_Username_color8{
    background-color: #74d12c;
}
`;

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
            <html>
                <head>
                    <meta charset="utf-8" />
                    <title>Exported Data</title>
                    <meta content="width=device-width, initial-scale=1.0" name="viewport" />
                    <link href="css/style.css" rel="stylesheet" />
                </head>
                <body>
                    <div class="mx_page_wrap">
                        <div class="mx_page_header">
                            <div class="mx_content">
                                <div class="mx_text mx_bold">${room.name}</div>
                            </div>
                        </div>
                        <div class="mx_page_body mx_chat_page">
                            <div class="mx_history">
                                ${content}
                            </div>
                        </div>
                    </div>
                </body>
            </html>
    `
    }

    protected isEdit(event: MatrixEvent) {
        if (event.getType() === "m.room.message" && event.getContent().hasOwnProperty("m.new_content")) return true;
        return false;
    }

    protected async getUserAvatar(event: MatrixEvent) {
        const member = event.sender;
        if (!member.getMxcAvatarUrl()) {
            return `
            <div class="mx_pull_left mx_userpic_wrap">
                <div 
                    class="mx_userpic mx_initials_wrap ${getUserNameColorClass(event.getSender())}" 
                    style="width: 42px;height: 42px;"
                >
                    <div class="mx_initials" style="line-height: 42px;" src="users/${member.userId}">
                        ${event.sender.name[0]}
                    </div>
                </div>
            </div>
            `;
        } else {
            const imageUrl = mediaFromMxc(member.getMxcAvatarUrl()).getThumbnailOfSourceHttp(42, 42, "crop");

            if (!this.avatars.has(member.userId)) {
                this.avatars.set(member.userId, true);
                const image = await fetch(imageUrl);
                const blob = await image.blob();
                this.zip.file(`users/${member.userId}`, blob);
            }

            return `
            <div class="mx_pull_left mx_userpic_wrap">
                <div class="mx_userpic" style="width: 42px; height: 42px;">
                    <img
                    class="mx_initials"
                    style="width: 42px;height: 42px;line-height:42px;"
                    src="users/${member.userId}"
                    />
                </div>
            </div>
            `;
        }
    }

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

    //Gets the event_id of an event to which an event is replied
    protected getBaseEventId = (event: MatrixEvent) => {
        const isEncrypted = event.isEncrypted();

        // If encrypted, in_reply_to lies in event.event.content
        const content = isEncrypted ? event.event.content : event.getContent();
        const relatesTo = content["m.relates_to"];
        return (relatesTo && relatesTo["m.in_reply_to"]) ? relatesTo["m.in_reply_to"]["event_id"] : null;
    };

    protected dateSeparator(event: MatrixEvent, prevEvent: MatrixEvent) {
        const prevDate = prevEvent ? new Date(prevEvent.getTs()) : null;
        const currDate = new Date(event.getTs());
        if (!prevDate || currDate.setHours(0, 0, 0, 0) !== prevDate.setHours(0, 0, 0, 0)) {
            return `
                <div class="mx_message mx_service">
                    <div class="mx_body mx_details">
                        ${new Date(event.getTs())
        .toLocaleString("en-us", {year: "numeric", month: "long", day: "numeric" })}
                    </div>
                </div>
                `;
        }
        return "";
    }

    protected async createMessageBody(event: MatrixEvent, joined = false, isReply = false, replyId = null) {
        const userPic = await this.getUserAvatar(event);
        let messageBody = "";
        switch (event.getContent().msgtype) {
            case "m.text":
                messageBody = `
                <div class="mx_text"> 
                    ${sanitizeHtml(event.getContent().body, sanitizeHtmlParams)} 
                </div>`;
                break;
            case "m.image": {
                const blob = await this.getMediaBlob(event);
                const fileName = `${event.getId()}.${blob.type.replace("image/", "")}`;
                messageBody = `
                    <a class="mx_photo_wrap mx_clearfix mx_pull_left" href="images/${event.getId()}.png">
                        <img 
                        class="mx_photo"
                        style="max-width: 600px; max-height: 500px;"
                        src="images/${fileName}"
                        />
                    </a>`;
                this.zip.file(`images/${fileName}`, blob);
                break;
            }
            case "m.video": {
                const blob = await this.getMediaBlob(event);
                const fileName = `${event.getId()}.${blob.type.replace("video/", "")}`;
                messageBody = `
                <div class="mx_media_wrap mx_clearfix">
                    <video 
                        class="mx_video_file" 
                        src="videos/${fileName}" 
                        style="max-height: 400px; max-width: 600px;" 
                        controls 
                    />
                </div>`;
                this.zip.file(`videos/${fileName}`, blob);
                break;
            }
            case "m.audio": {
                const blob = await this.getMediaBlob(event);
                const fileName = `${event.getId()}.${blob.type.replace("audio/", "")}`;
                messageBody = `
                <div class="mx_media_wrap mx_clearfix">
                    <audio
                        class="mx_audio_file"
                        src="audio/${fileName}"
                        controls
                    />
                </div>`;
                this.zip.file(`audio/${fileName}`, blob);
                break;
            }
            default:
                break;
        }

        return `
        <div class="mx_message mx_default mx_clearfix ${joined ? `mx_joined` : ``}" id="${event.getId()}">
        ${!joined ? userPic : ``}
            <div class="mx_body">
                <div class="mx_pull_right mx_date mx_details" title="${new Date(event.getTs())}">
                    ${new Date(event.getTs()).toLocaleTimeString().slice(0, -3)}
                </div>
        ${!joined ? `
                <div class="mx_from_name ${getUserNameColorClass(event.getSender())}">
                    ${event.sender.name}
                </div>`: ``}
            ${isReply ?
        `   <div class="mx_reply_to mx_details">
                    In reply to <a href="#${replyId}">this message</a>
                </div>`: ``}
            ${messageBody}
            </div>
        </div>
        `;
    }

    protected async createHTML(events: MatrixEvent[], room: Room) {
        let content = "";
        let prevEvent = null;
        for (const event of events) {
            // As the getContent of the edited event fetches the latest edit, there is no need to process edit events
            if (this.isEdit(event)) continue;
            content += this.dateSeparator(event, prevEvent);

            if (event.getType() === "m.room.message") {
                const replyTo = this.getBaseEventId(event);
                const shouldBeJoined = prevEvent && prevEvent.getContent().msgtype === "m.text"
                && event.sender.userId === prevEvent.sender.userId && !this.dateSeparator(event, prevEvent) && !replyTo;

                const body = await this.createMessageBody(event, shouldBeJoined, !!replyTo, replyTo);
                content += body;
            } else {
                const eventText = textForEvent(event);
                content += eventText ? `
                <div class="mx_message mx_service" id="${event.getId()}">
                    <div class="mx_body mx_details">
                        ${textForEvent(event)}
                    </div>
                </div>
                ` : "";
            }
            prevEvent = event;
        }
        return this.wrapHTML(content, room);
    }

    public async export() {
        const html = await this.createHTML(this.res, this.room);

        this.zip.file("index.html", html);
        this.zip.file("css/style.css", css);

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

