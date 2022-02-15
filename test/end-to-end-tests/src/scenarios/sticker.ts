/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import * as http from "http";
import { AddressInfo } from "net";

import { RestSessionCreator } from "../rest/creator";
import { ElementSession } from "../session";
import { login } from "../usecases/login";
import { selectRoom } from "../usecases/select-room";
import { sendSticker } from "../usecases/send-sticker";

const STICKER_PICKER_WIDGET_ID = "fake-sticker-picker";
const ROOM_NAME_1 = "Sticker Test";
const ROOM_NAME_2 = "Sticker Test Two";
const STICKER_MESSAGE = JSON.stringify({
    action: "m.sticker",
    api: "fromWidget",
    data: {
        name: "teststicker",
        description: "Test Sticker",
        file: "test.png",
        content: {
            body: "Test Sticker",
            msgtype: "m.sticker",
            url: "mxc://somewhere",
        },
    },
    requestId: "1",
    widgetId: STICKER_PICKER_WIDGET_ID,
});
const WIDGET_HTML = `
    <html>
        <head>
            <title>Fake Sticker Picker</title>
            <script>
                window.onmessage = ev => {
                    if (ev.data.action === 'capabilities') {
                        window.parent.postMessage(Object.assign({
                            response: {
                                capabilities: ["m.sticker"]
                            },
                        }, ev.data), '*');
                    }
                };
            </script>
        </head>
        <body>
            <button name="Send" id="sendsticker">Press for sticker</button>
            <script>
                document.getElementById('sendsticker').onclick = () => {
                    window.parent.postMessage(${STICKER_MESSAGE}, '*')
                };
            </script>
        </body>
    </html>
`;

class WidgetServer {
    private server: http.Server = null;

    start() {
        this.server = http.createServer(this.onRequest);
        this.server.listen();
    }

    stop() {
        this.server.close();
    }

    get port(): number {
        return (this.server.address()as AddressInfo).port;
    }

    onRequest = (req: http.IncomingMessage, res: http.ServerResponse) => {
        res.writeHead(200);
        res.end(WIDGET_HTML);
    };
}

export async function stickerScenarios(
    username: string, password: string,
    session: ElementSession, restCreator: RestSessionCreator,
): Promise<void> {
    console.log(" making account to test stickers");

    const creds = await restCreator.createSession(username, password);

    // we make the room here which also approves the consent stuff
    // (besides, we test creating rooms elsewhere: no need to do so again)
    await creds.createRoom(ROOM_NAME_1, {});
    await creds.createRoom(ROOM_NAME_2, {});

    console.log(" injecting fake sticker picker");

    const widgetServer = new WidgetServer();
    widgetServer.start();

    const stickerPickerUrl = `http://localhost:${widgetServer.port}/`;

    await creds.put(`/user/${encodeURIComponent(creds.userId())}/account_data/m.widgets`, {
        "fake_sticker_picker": {
            content: {
                type: "m.stickerpicker",
                name: "Fake Stickers",
                url: stickerPickerUrl,
            },
            id: STICKER_PICKER_WIDGET_ID,
        },
    });

    await login(session, username, password, session.hsUrl);

    session.log.startGroup(`can send a sticker`);
    await selectRoom(session, ROOM_NAME_1);
    await sendSticker(session);
    session.log.endGroup();

    // switch to another room & send another one
    session.log.startGroup(`can send a sticker to another room`);

    const navPromise = session.page.waitForNavigation();
    await selectRoom(session, ROOM_NAME_2);
    await navPromise;

    await sendSticker(session);
    session.log.endGroup();

    widgetServer.stop();
}
