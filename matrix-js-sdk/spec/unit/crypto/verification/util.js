/*
Copyright 2019 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import nodeCrypto from "crypto";

import { TestClient } from '../../../TestClient';
import { MatrixEvent } from "../../../../src/models/event";
import { logger } from '../../../../src/logger';

export async function makeTestClients(userInfos, options) {
    const clients = [];
    const clientMap = {};
    const sendToDevice = function(type, map) {
        // logger.log(this.getUserId(), "sends", type, map);
        for (const [userId, devMap] of Object.entries(map)) {
            if (userId in clientMap) {
                for (const [deviceId, msg] of Object.entries(devMap)) {
                    if (deviceId in clientMap[userId]) {
                        const event = new MatrixEvent({
                            sender: this.getUserId(), // eslint-disable-line @babel/no-invalid-this
                            type: type,
                            content: msg,
                        });
                        const client = clientMap[userId][deviceId];
                        const decryptionPromise = event.isEncrypted() ?
                            event.attemptDecryption(client.crypto) :
                            Promise.resolve();

                        decryptionPromise.then(
                            () => client.emit("toDeviceEvent", event),
                        );
                    }
                }
            }
        }
    };
    const sendEvent = function(room, type, content) {
        // make up a unique ID as the event ID
        const eventId = "$" + this.makeTxnId(); // eslint-disable-line @babel/no-invalid-this
        const rawEvent = {
            sender: this.getUserId(), // eslint-disable-line @babel/no-invalid-this
            type: type,
            content: content,
            room_id: room,
            event_id: eventId,
            origin_server_ts: Date.now(),
        };
        const event = new MatrixEvent(rawEvent);
        const remoteEcho = new MatrixEvent(Object.assign({}, rawEvent, {
            unsigned: {
                transaction_id: this.makeTxnId(), // eslint-disable-line @babel/no-invalid-this
            },
        }));

        setImmediate(() => {
            for (const tc of clients) {
                if (tc.client === this) { // eslint-disable-line @babel/no-invalid-this
                    logger.log("sending remote echo!!");
                    tc.client.emit("Room.timeline", remoteEcho);
                } else {
                    tc.client.emit("Room.timeline", event);
                }
            }
        });

        return Promise.resolve({ event_id: eventId });
    };

    for (const userInfo of userInfos) {
        let keys = {};
        if (!options) options = {};
        if (!options.cryptoCallbacks) options.cryptoCallbacks = {};
        if (!options.cryptoCallbacks.saveCrossSigningKeys) {
            options.cryptoCallbacks.saveCrossSigningKeys = k => { keys = k; };
            options.cryptoCallbacks.getCrossSigningKey = typ => keys[typ];
        }
        const testClient = new TestClient(
            userInfo.userId, userInfo.deviceId, undefined, undefined,
            options,
        );
        if (!(userInfo.userId in clientMap)) {
            clientMap[userInfo.userId] = {};
        }
        clientMap[userInfo.userId][userInfo.deviceId] = testClient.client;
        testClient.client.sendToDevice = sendToDevice;
        testClient.client.sendEvent = sendEvent;
        clients.push(testClient);
    }

    await Promise.all(clients.map((testClient) => testClient.client.initCrypto()));

    return clients;
}

export function setupWebcrypto() {
    global.crypto = {
        getRandomValues: (buf) => {
            return nodeCrypto.randomFillSync(buf);
        },
    };
}

export function teardownWebcrypto() {
    global.crypto = undefined;
}
