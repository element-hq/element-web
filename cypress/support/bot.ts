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

/// <reference types="cypress" />

import request from "browser-request";

import type { ISendEventResponse, MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { SynapseInstance } from "../plugins/synapsedocker";
import Chainable = Cypress.Chainable;

interface CreateBotOpts {
    /**
     * Whether the bot should automatically accept all invites.
     */
    autoAcceptInvites?: boolean;
    /**
     * The display name to give to that bot user
     */
    displayName?: string;
    /**
     * Whether or not to start the syncing client.
     */
    startClient?: boolean;
}

const defaultCreateBotOptions = {
    autoAcceptInvites: true,
    startClient: true,
} as CreateBotOpts;

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            /**
             * Returns a new Bot instance
             * @param synapse the instance on which to register the bot user
             * @param opts create bot options
             */
            getBot(synapse: SynapseInstance, opts: CreateBotOpts): Chainable<MatrixClient>;
            /**
             * Let a bot join a room
             * @param cli The bot's MatrixClient
             * @param roomId ID of the room to join
             */
            botJoinRoom(cli: MatrixClient, roomId: string): Chainable<Room>;
            /**
             * Let a bot join a room by name
             * @param cli The bot's MatrixClient
             * @param roomName Name of the room to join
             */
            botJoinRoomByName(cli: MatrixClient, roomName: string): Chainable<Room>;
            /**
             * Send a message as a bot into a room
             * @param cli The bot's MatrixClient
             * @param roomId ID of the room to join
             * @param message the message body to send
             */
            botSendMessage(cli: MatrixClient, roomId: string, message: string): Chainable<ISendEventResponse>;
        }
    }
}

Cypress.Commands.add("getBot", (synapse: SynapseInstance, opts: CreateBotOpts): Chainable<MatrixClient> => {
    opts = Object.assign({}, defaultCreateBotOptions, opts);
    const username = Cypress._.uniqueId("userId_");
    const password = Cypress._.uniqueId("password_");
    return cy.registerUser(synapse, username, password, opts.displayName).then(credentials => {
        return cy.window({ log: false }).then(win => {
            const cli = new win.matrixcs.MatrixClient({
                baseUrl: synapse.baseUrl,
                userId: credentials.userId,
                deviceId: credentials.deviceId,
                accessToken: credentials.accessToken,
                request,
                store: new win.matrixcs.MemoryStore(),
                scheduler: new win.matrixcs.MatrixScheduler(),
                cryptoStore: new win.matrixcs.MemoryCryptoStore(),
            });

            if (opts.autoAcceptInvites) {
                cli.on(win.matrixcs.RoomMemberEvent.Membership, (event, member) => {
                    if (member.membership === "invite" && member.userId === cli.getUserId()) {
                        cli.joinRoom(member.roomId);
                    }
                });
            }

            if (!opts.startClient) {
                return cy.wrap(cli);
            }

            return cy.wrap(
                cli.initCrypto()
                    .then(() => cli.setGlobalErrorOnUnknownDevices(false))
                    .then(() => cli.startClient())
                    .then(() => cli.bootstrapCrossSigning({
                        authUploadDeviceSigningKeys: async func => { await func({}); },
                    }))
                    .then(() => cli),
            );
        });
    });
});

Cypress.Commands.add("botJoinRoom", (cli: MatrixClient, roomId: string): Chainable<Room> => {
    return cy.wrap(cli.joinRoom(roomId));
});

Cypress.Commands.add("botJoinRoomByName", (cli: MatrixClient, roomName: string): Chainable<Room> => {
    const room = cli.getRooms().find((r) => r.getDefaultRoomName(cli.getUserId()) === roomName);

    if (room) {
        return cy.botJoinRoom(cli, room.roomId);
    }

    return cy.wrap(Promise.reject());
});

Cypress.Commands.add("botSendMessage", (
    cli: MatrixClient,
    roomId: string,
    message: string,
): Chainable<ISendEventResponse> => {
    return cy.wrap(cli.sendMessage(roomId, {
        msgtype: "m.text",
        body: message,
    }), { log: false });
});
