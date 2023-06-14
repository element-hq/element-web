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

import { TestClient } from "../../../TestClient";
import { IContent, MatrixEvent } from "../../../../src/models/event";
import { IRoomTimelineData } from "../../../../src/models/event-timeline-set";
import { Room, RoomEvent } from "../../../../src/models/room";
import { logger } from "../../../../src/logger";
import { MatrixClient, ClientEvent, ICreateClientOpts, SendToDeviceContentMap } from "../../../../src/client";

interface UserInfo {
    userId: string;
    deviceId: string;
}

export async function makeTestClients(
    userInfos: UserInfo[],
    options: Partial<ICreateClientOpts>,
): Promise<[TestClient[], () => void]> {
    const clients: TestClient[] = [];
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const clientMap: Record<string, Record<string, MatrixClient>> = {};
    const makeSendToDevice =
        (matrixClient: MatrixClient): MatrixClient["sendToDevice"] =>
        async (type: string, contentMap: SendToDeviceContentMap) => {
            // logger.log(this.getUserId(), "sends", type, map);
            for (const [userId, deviceMessages] of contentMap) {
                if (userId in clientMap) {
                    for (const [deviceId, message] of deviceMessages) {
                        if (deviceId in clientMap[userId]) {
                            const event = new MatrixEvent({
                                sender: matrixClient.getUserId()!,
                                type: type,
                                content: message,
                            });
                            const client = clientMap[userId][deviceId];
                            const decryptionPromise = event.isEncrypted()
                                ? event.attemptDecryption(client.crypto!)
                                : Promise.resolve();

                            decryptionPromise.then(() => client.emit(ClientEvent.ToDeviceEvent, event));
                        }
                    }
                }
            }
            return {};
        };
    const makeSendEvent = (matrixClient: MatrixClient) => (room: string, type: string, content: IContent) => {
        // make up a unique ID as the event ID
        const eventId = "$" + matrixClient.makeTxnId();
        const rawEvent = {
            sender: matrixClient.getUserId()!,
            type: type,
            content: content,
            room_id: room,
            event_id: eventId,
            origin_server_ts: Date.now(),
        };
        const event = new MatrixEvent(rawEvent);
        const remoteEcho = new MatrixEvent(
            Object.assign({}, rawEvent, {
                unsigned: {
                    transaction_id: matrixClient.makeTxnId(),
                },
            }),
        );

        const timeout = setTimeout(() => {
            for (const tc of clients) {
                const room = new Room("test", tc.client, tc.client.getUserId()!);
                const roomTimelineData = {} as unknown as IRoomTimelineData;
                if (tc.client === matrixClient) {
                    logger.log("sending remote echo!!");
                    tc.client.emit(RoomEvent.Timeline, remoteEcho, room, false, false, roomTimelineData);
                } else {
                    tc.client.emit(RoomEvent.Timeline, event, room, false, false, roomTimelineData);
                }
            }
        });

        timeouts.push(timeout as unknown as ReturnType<typeof setTimeout>);

        return Promise.resolve({ event_id: eventId });
    };

    for (const userInfo of userInfos) {
        let keys: Record<string, Uint8Array> = {};
        if (!options) options = {};
        if (!options.cryptoCallbacks) options.cryptoCallbacks = {};
        if (!options.cryptoCallbacks.saveCrossSigningKeys) {
            options.cryptoCallbacks.saveCrossSigningKeys = (k) => {
                keys = k;
            };
            // @ts-ignore tsc getting confused by overloads
            options.cryptoCallbacks.getCrossSigningKey = (typ) => keys[typ];
        }
        const testClient = new TestClient(userInfo.userId, userInfo.deviceId, undefined, undefined, options);
        if (!(userInfo.userId in clientMap)) {
            clientMap[userInfo.userId] = {};
        }
        clientMap[userInfo.userId][userInfo.deviceId] = testClient.client;
        testClient.client.sendToDevice = makeSendToDevice(testClient.client);
        // @ts-ignore tsc getting confused by overloads
        testClient.client.sendEvent = makeSendEvent(testClient.client);
        clients.push(testClient);
    }

    await Promise.all(clients.map((testClient) => testClient.client.initCrypto()));

    const destroy = () => {
        timeouts.forEach((t) => clearTimeout(t));
    };

    return [clients, destroy];
}
