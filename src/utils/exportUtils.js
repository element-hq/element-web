import { MatrixClientPeg } from "../MatrixClientPeg";
import { arrayFastClone } from "./arrays";
import { TimelineWindow } from "matrix-js-sdk/src/timeline-window";
import JSZip from "jszip";
import { textForEvent } from "../TextForEvent";
import streamSaver from "streamsaver";

const wrapHTML = (content, room) => (`
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


const getTimelineConversation = (room) => {
    if (!room) return;

    const cli = MatrixClientPeg.get();

    const timelineSet = room.getUnfilteredTimelineSet();

    const timelineWindow = new TimelineWindow(
        cli, timelineSet,
        {windowLimit: Number.MAX_VALUE});

    timelineWindow.load(null, 20);

    const events = timelineWindow.getEvents();

    // Clone and reverse the events so that we preserve the order
    arrayFastClone(events)
        .reverse()
        .forEach(event => {
            cli.decryptEventIfNeeded(event);
        });

    if (!timelineWindow.canPaginate('f')) {
        events.push(...timelineSet.getPendingEvents());
    }
    console.log(events);
    return events;
};


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
    width: 480px;
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
    color: #3892db;
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
    "#e671a5",
    "#47bcd1",
    "#ff8c44",
];


//Get a color associated with a string. This is to map userId to a specific color
const getUserColor = (userId) => {
    return userColors[userId.length % 4];
};

const createMessageBody = (event, joined = false, isReply = false, replyId = null) => {
    return `
    <div class="message default clearfix ${joined ? `joined` : ``}" id="message2680">
      ${!joined ? `<div class="pull_left userpic_wrap">
       <div class="userpic" style="width: 42px; height: 42px; background-color: ${getUserColor(event.sender.name)}">
        <div class="initials" style="line-height: 42px">${event.sender.name[0]}</div>
       </div>
      </div>` : ``}
      <div class="body">
       <div class="pull_right date details" title="${new Date(event.getTs())}">${new Date(event.getTs()).toLocaleTimeString().slice(0, -3)}</div>
       ${!joined ? `<div class="from_name" style="color:${getUserColor(event.sender.name)}">
            ${event.sender.name}
       </div>`: ``}
        ${isReply ?
        `<div class="reply_to details">
            In reply to <a href="#${replyId}">this message</a>
         </div>`: ``}
       <div class="text"> ${event.getContent().body} </div>
      </div>
     </div>
    `;
};

const replyId = (event) => {
    const relatesTo = event.getContent()["m.relates_to"];
    const replyId = relatesTo ? relatesTo["m.in_reply_to"].event_id : null;
    return replyId;
};


const dateSeparator = (event, prevEvent) => {
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

const createHTML = (events, room) => {
    let content = "";
    let prevEvent = null;
    for (const event of events) {
        content += dateSeparator(event, prevEvent);
        if (event.getType() === "m.room.message") {
            const shouldBeJoined = prevEvent && prevEvent.getContent().msgtype === "m.text"
            && event.sender.userId === prevEvent.sender.userId && !dateSeparator(event, prevEvent);

            const body = createMessageBody(event, shouldBeJoined, !!replyId(event), replyId(event));

            content += body;
        } else {
            content += `
            <div class="message service" id="${event.getId()}">
                <div class="body details">
                    ${textForEvent(event)}
                </div>
            </div>
            `;
        }
        prevEvent = event;
    }
    return wrapHTML(content, room);
};


const exportConversationalHistory = async (room) => {
    const res = getTimelineConversation(room);
    const zip = new JSZip();
    const html = createHTML(res, room);
    zip.file("css/style.css", css);
    zip.file("index.html", html);
    const filename = `matrix-export-${new Date().toISOString()}.zip`;

    //Generate the zip file asynchronously

    const blob = await zip.generateAsync({ type: "blob" });

    //Create a writable stream to the directory
    const fileStream = streamSaver.createWriteStream(filename, blob.size);
    const writer = fileStream.getWriter();

    // console.log(blob.size);

    // Here we chunk the blob into pieces of 10 MiB
    const sliceSize = 10 * 1e6;
    for (let fPointer = 0; fPointer < blob.size; fPointer += sliceSize) {
        // console.log(fPointer);
        const blobPiece = blob.slice(fPointer, fPointer + sliceSize);
        const reader = new FileReader();

        const waiter = new Promise((resolve, reject) => {
            reader.onloadend = evt => {
                const arrayBufferNew = evt.target.result;
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
};

export default exportConversationalHistory;
