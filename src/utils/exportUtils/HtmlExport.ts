
import streamSaver from "streamsaver";
import JSZip from "jszip";
import { decryptFile } from "../DecryptFile";
import { mediaFromContent, mediaFromMxc } from "../../customisations/Media";
import { textForEvent } from "../../TextForEvent";
import Room from 'matrix-js-sdk/src/models/room';
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

const wrapHTML = (content: string, room: Room) => (`
    <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8" />
            <title>Exported Data</title>
            <meta content="width=device-width, initial-scale=1.0" name="viewport" />
            <link href="css/style.css" rel="stylesheet" />
            <script src="js/script.js" type="text/javascript"></script>
        </head>
        <body>
            <div class="page_wrap">
            <div class="page_header">
                <div class="content">
                <div class="text bold">${room.name}</div>
                </div>
            </div>
            <div class="page_body chat_page">
                <div class="history">
                    ${content}
                </div>
            </div>
            </div>
        </body>
        </html>
`);


const css = `
body {
    margin: 0;
    font: 12px/18px 'Inter', 'Open Sans',"Lucida Grande","Lucida Sans Unicode",Arial,Helvetica,Verdana,sans-serif;
}

strong {
    font-weight: 700;
}

code, kbd, pre, samp {
    font-family: Menlo,Monaco,Consolas,"Courier New",monospace;
}

code {
    padding: 2px 4px;
    font-size: 90%;
    color: #c7254e;
    background-color: #f9f2f4;
    border-radius: 4px;
}

pre {
    display: block;
    margin: 0;
    line-height: 1.42857143;
    word-break: break-all;
    word-wrap: break-word;
    color: #333;
    background-color: #f5f5f5;
    border-radius: 4px;
    overflow: auto;
    padding: 3px;
    border: 1px solid #eee;
    max-height: none;
    font-size: inherit;
}

.clearfix:after {
    content: " ";
    visibility: hidden;
    display: block;
    height: 0;
    clear: both;
}

.pull_left {
    float: left;
}

.pull_right {
    float: right;
}

.page_wrap {
    background-color: #ffffff;
    color: #000000;
}

.page_wrap a {
    color: #168acd;
    text-decoration: none;
}

.page_wrap a:hover {
    text-decoration: underline;
}

.page_header {
    position: fixed;
    z-index: 10;
    background-color: #ffffff;
    width: 100%;
    border-bottom: 1px solid #e3e6e8;
}

.page_header .content {
    width: 480px;
    margin: 0 auto;
    border-radius: 0 !important;
}

.page_header a.content {
    background-repeat: no-repeat;
    background-position: 24px 21px;
    background-size: 24px 24px;
}

.bold {
    color: #212121;
    font-weight: 700;
}

.details {
    color: #70777b;
}

.page_header .content .text {
    padding: 24px 24px 22px 24px;
    font-size: 22px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
}

.page_header a.content .text {
    padding: 24px 24px 22px 82px;
}

.page_body {
    padding-top: 64px;
    width: 700px;
    margin: 0 auto;
}

.userpic {
    display: block;
    border-radius: 50%;
    overflow: hidden;
}

.userpic .initials {
    display: block;
    color: #fff;
    text-align: center;
    text-transform: uppercase;
    user-select: none;
}

a.block_link {
    display: block;
    text-decoration: none !important;
    border-radius: 4px;
}

a.block_link:hover {
    text-decoration: none !important;
    background-color: #f5f7f8;
}

.history {
    padding: 16px 0;
}

.message {
    margin: 0 -10px;
    transition: background-color 2.0s ease;
}

div.selected {
    background-color: rgba(242,246,250,255);
    transition: background-color 0.5s ease;
}

.service {
    padding: 10px 24px;
}

.service .body {
    text-align: center;
}

.message .userpic .initials {
    font-size: 16px;
}

.default {
    padding: 10px;
}

.default.joined {
    margin-top: -10px;
}

.default .from_name {
    font-weight: 700;
    padding-bottom: 5px;
}

.default .body {
    margin-left: 60px;
}

.default .text {
    word-wrap: break-word;
    line-height: 150%;
}

.default .reply_to,
.default .media_wrap {
    padding-bottom: 5px;
}

.default .media {
    margin: 0 -10px;
    padding: 5px 10px;
}

.default .media .fill,
.default .media .thumb {
    width: 48px;
    height: 48px;
    border-radius: 50%;
}

.default .media .fill {
    background-repeat: no-repeat;
    background-position: 12px 12px;
    background-size: 24px 24px;
}

.default .media .title,
.default .media_poll .question {
    padding-top: 4px;
    font-size: 14px;
}

.default .media .description {
    color: #000000;
    padding-top: 4px;
    font-size: 13px;
}

.default .media .status {
    padding-top: 4px;
    font-size: 13px;
}

.default .photo {
    display: block;
}
`;


const userColors = [
    "#64bf47",
    "#4f9cd9",
    "#9884e8",
];

//Get a color associated with string length. This is to map userId to a specific color
const getUserColor = (userId: string) => {
    return userColors[userId.length % 4];
};


const getUserPic = async (event: MatrixEvent) => {
    const member = event.sender;
    if (!member.getMxcAvatarUrl()) {
        return `
        <div class="pull_left userpic_wrap">
            <div class="userpic" style="width: 42px;height: 42px;background-color: ${getUserColor(member.userId)}">
                <div class="initials" style="line-height: 42px;" src="users/${member.userId}">
                    ${event.sender.name[0]}
                </div>
            </div>
        </div>
           `;
    } else {
        const imageUrl = mediaFromMxc(member.getMxcAvatarUrl()).getThumbnailOfSourceHttp(42, 42, "crop");

        if (!avatars.has(member.userId)) {
            avatars.set(member.userId, true);
            const image = await fetch(imageUrl);
            const blob = await image.blob();
            zip.file(`users/${member.userId}`, blob);
        }

        return `
        <div class="pull_left userpic_wrap">
            <div class="userpic" style="width: 42px; height: 42px;">
                <img class="initials" style="width: 42px;height: 42px;line-height:42px;" src="users/${member.userId}"/>
            </div>
        </div>
           `;
    }
};

//Gets the event_id of an event to which an event is replied
const getBaseEventId = (event: MatrixEvent) => {
    const isEncrypted = event.isEncrypted();

    // If encrypted, in_reply_to lies in event.event.content
    const content = isEncrypted ? event.event.content : event.getContent();
    const relatesTo = content["m.relates_to"];
    return (relatesTo && relatesTo["m.in_reply_to"]) ? relatesTo["m.in_reply_to"]["event_id"] : null;
};

const isEdit = (event: MatrixEvent) => {
    if (event.getType() === "m.room.message" && event.getContent().hasOwnProperty("m.new_content")) return true;
    return false;
}

const dateSeparator = (event: MatrixEvent, prevEvent: MatrixEvent) => {
    const prevDate = prevEvent ? new Date(prevEvent.getTs()) : null;
    const currDate = new Date(event.getTs());
    if (!prevDate || currDate.setHours(0, 0, 0, 0) !== prevDate.setHours(0, 0, 0, 0)) {
        return `
            <div class="message service">
                <div class="body details">
                    ${new Date(event.getTs())
        .toLocaleString("en-us", {year: "numeric", month: "long", day: "numeric" })}
                </div>
            </div>
            `;
    }
    return "";
};

const getImageData = async (event: MatrixEvent) => {
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
        console.log("Error decrypting image");
    }
    return blob;
};


const createMessageBody = async (event: MatrixEvent, joined = false, isReply = false, replyId = null) => {
    const userPic = await getUserPic(event);
    let messageBody = "";
    switch (event.getContent().msgtype) {
        case "m.text":
            messageBody = `<div class="text"> ${event.getContent().body} </div>`;
            break;
        case "m.image": {
            messageBody = `
                <a class="photo_wrap clearfix pull_left" href="images/${event.getId()}.png">
                    <img class="photo" src="images/${event.getId()}.png" style="max-width: 600px; max-height: 500px;">
                </a>`;
            const blob = await getImageData(event);
            zip.file(`images/${event.getId()}.png`, blob);
        }
            break;
        default:
            break;
    }

    return `
    <div class="message default clearfix ${joined ? `joined` : ``}" id="${event.getId()}">
      ${!joined ? userPic : ``}
        <div class="body">
            <div class="pull_right date details" title="${new Date(event.getTs())}">
                ${new Date(event.getTs()).toLocaleTimeString().slice(0, -3)}
            </div>
       ${!joined ? `
            <div class="from_name" style="color:${getUserColor(event.sender.name)}">
                ${event.sender.name}
            </div>`: ``}
        ${isReply ?
        `   <div class="reply_to details">
                In reply to <a href="#${replyId}">this message</a>
            </div>`: ``}
        ${messageBody}
        </div>
    </div>
    `;
};


const createHTML = async (events: MatrixEvent[], room: Room) => {
    let content = "";
    let prevEvent = null;
    for (const event of events) {
        // As the getContent of the edited event fetches the latest edit, there is no need to process edit events
        if (isEdit(event)) continue;
        content += dateSeparator(event, prevEvent);

        if (event.getType() === "m.room.message") {
            const replyTo = getBaseEventId(event);
            const shouldBeJoined = prevEvent && prevEvent.getContent().msgtype === "m.text"
            && event.sender.userId === prevEvent.sender.userId && !dateSeparator(event, prevEvent) && !replyTo;

            const body = await createMessageBody(event, shouldBeJoined, !!replyTo, replyTo);
            content += body;
        } else {
            const eventText = textForEvent(event);
            content += eventText ? `
            <div class="message service" id="${event.getId()}">
                <div class="body details">
                    ${textForEvent(event)}
                </div>
            </div>
            ` : "";
        }
        prevEvent = event;
    }
    return wrapHTML(content, room);
};

const avatars = new Map();
let zip: any;

const exportAsHTML = async (res: MatrixEvent[], room: Room) => {
    zip = new JSZip();

    const html = await createHTML(res, room);

    zip.file("index.html", html);
    zip.file("css/style.css", css);

    avatars.clear();

    const filename = `matrix-export-${new Date().toISOString()}.zip`;

    //Generate the zip file asynchronously
    const blob = await zip.generateAsync({ type: "blob" });

    //Create a writable stream to the directory
    const fileStream = streamSaver.createWriteStream(filename, blob.size);
    const writer = fileStream.getWriter();

    // Here we chunk the blob into pieces of 10 MB, the size might be dynamically generated.
    // This can be used to keep track of the progress
    const sliceSize = 10 * 1e6;
    for (let fPointer = 0; fPointer < blob.size; fPointer += sliceSize) {
        // console.log(fPointer);
        const blobPiece = blob.slice(fPointer, fPointer + sliceSize);
        const reader = new FileReader();

        const waiter = new Promise<void>((resolve, reject) => {
            reader.onloadend = evt => {
                const arrayBufferNew: any = evt.target.result;
                const uint8ArrayNew = new Uint8Array(arrayBufferNew);
                // Buffer.from(reader.result)
                writer.write(uint8ArrayNew);
                resolve();
            };
            reader.readAsArrayBuffer(blobPiece);
        });
        await waiter;
    }
    writer.close();
}

export default exportAsHTML;
