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

import type { FileType, Upload, UploadOpts } from "matrix-js-sdk/src/http-api";
import type { ICreateRoomOpts, ISendEventResponse } from "matrix-js-sdk/src/@types/requests";
import type { MatrixClient } from "matrix-js-sdk/src/client";
import type { Room } from "matrix-js-sdk/src/models/room";
import type { IContent, MatrixEvent } from "matrix-js-sdk/src/models/event";
import type { ReceiptType } from "matrix-js-sdk/src/@types/read_receipts";
import Chainable = Cypress.Chainable;
import { UserCredentials } from "./login";

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            /**
             * Returns the MatrixClient from the MatrixClientPeg
             */
            getClient(): Chainable<MatrixClient | undefined>;
            /**
             * Create a room with given options.
             * @param options the options to apply when creating the room
             * @return the ID of the newly created room
             */
            createRoom(options: ICreateRoomOpts): Chainable<string>;
            /**
             * Create a space with given options.
             * @param options the options to apply when creating the space
             * @return the ID of the newly created space (room)
             */
            createSpace(options: ICreateRoomOpts): Chainable<string>;
            /**
             * Invites the given user to the given room.
             * @param roomId the id of the room to invite to
             * @param userId the id of the user to invite
             */
            inviteUser(roomId: string, userId: string): Chainable<{}>;
            /**
             * Sets account data for the user.
             * @param type The type of account data.
             * @param data The data to store.
             */
            setAccountData(type: string, data: object): Chainable<{}>;
            /**
             * @param {string} roomId
             * @param {string} threadId
             * @param {string} eventType
             * @param {Object} content
             * @return {module:http-api.MatrixError} Rejects: with an error response.
             */
            sendEvent(
                roomId: string,
                threadId: string | null,
                eventType: string,
                content: IContent,
            ): Chainable<ISendEventResponse>;
            /**
             * @param {MatrixEvent} event
             * @param {ReceiptType} receiptType
             * @param {boolean} unthreaded
             * @return {module:http-api.MatrixError} Rejects: with an error response.
             */
            sendReadReceipt(event: MatrixEvent, receiptType?: ReceiptType, unthreaded?: boolean): Chainable<{}>;
            /**
             * @param {string} name
             * @param {module:client.callback} callback Optional.
             * @return {Promise} Resolves: {} an empty object.
             * @return {module:http-api.MatrixError} Rejects: with an error response.
             */
            setDisplayName(name: string): Chainable<{}>;
            /**
             * @param {string} url
             * @param {module:client.callback} callback Optional.
             * @return {Promise} Resolves: {} an empty object.
             * @return {module:http-api.MatrixError} Rejects: with an error response.
             */
            setAvatarUrl(url: string): Chainable<{}>;
            /**
             * Upload a file to the media repository on the homeserver.
             *
             * @param {object} file The object to upload. On a browser, something that
             *   can be sent to XMLHttpRequest.send (typically a File).  Under node.js,
             *   a a Buffer, String or ReadStream.
             */
            uploadContent(file: FileType, opts?: UploadOpts): Chainable<Awaited<Upload["promise"]>>;
            /**
             * Turn an MXC URL into an HTTP one. <strong>This method is experimental and
             * may change.</strong>
             * @param {string} mxcUrl The MXC URL
             * @param {Number} width The desired width of the thumbnail.
             * @param {Number} height The desired height of the thumbnail.
             * @param {string} resizeMethod The thumbnail resize method to use, either
             * "crop" or "scale".
             * @param {Boolean} allowDirectLinks If true, return any non-mxc URLs
             * directly. Fetching such URLs will leak information about the user to
             * anyone they share a room with. If false, will return null for such URLs.
             * @return {?string} the avatar URL or null.
             */
            mxcUrlToHttp(
                mxcUrl: string,
                width?: number,
                height?: number,
                resizeMethod?: string,
                allowDirectLinks?: boolean,
            ): string | null;
            /**
             * Gets the list of DMs with a given user
             * @param userId The ID of the user
             * @return the list of DMs with that user
             */
            getDmRooms(userId: string): Chainable<string[]>;
            /**
             * Boostraps cross-signing.
             */
            bootstrapCrossSigning(credendtials: UserCredentials): Chainable<void>;
            /**
             * Joins the given room by alias or ID
             * @param roomIdOrAlias the id or alias of the room to join
             */
            joinRoom(roomIdOrAlias: string): Chainable<Room>;
        }
    }
}

Cypress.Commands.add("getClient", (): Chainable<MatrixClient | undefined> => {
    return cy.window({ log: false }).then((win) => win.mxMatrixClientPeg.matrixClient);
});

Cypress.Commands.add("getDmRooms", (userId: string): Chainable<string[]> => {
    return cy
        .getClient()
        .then((cli) => cli.getAccountData("m.direct")?.getContent<Record<string, string[]>>())
        .then((dmRoomMap) => dmRoomMap[userId] ?? []);
});

Cypress.Commands.add("createRoom", (options: ICreateRoomOpts): Chainable<string> => {
    return cy.window({ log: false }).then(async (win) => {
        const cli = win.mxMatrixClientPeg.matrixClient;
        const resp = await cli.createRoom(options);
        const roomId = resp.room_id;

        if (!cli.getRoom(roomId)) {
            await new Promise<void>((resolve) => {
                const onRoom = (room: Room) => {
                    if (room.roomId === roomId) {
                        cli.off(win.matrixcs.ClientEvent.Room, onRoom);
                        resolve();
                    }
                };
                cli.on(win.matrixcs.ClientEvent.Room, onRoom);
            });
        }

        return roomId;
    });
});

Cypress.Commands.add("createSpace", (options: ICreateRoomOpts): Chainable<string> => {
    return cy.createRoom({
        ...options,
        creation_content: {
            type: "m.space",
        },
    });
});

Cypress.Commands.add("inviteUser", (roomId: string, userId: string): Chainable<{}> => {
    return cy.getClient().then(async (cli: MatrixClient) => {
        const res = await cli.invite(roomId, userId);
        Cypress.log({ name: "inviteUser", message: `sent invite in ${roomId} for ${userId}` });
        return res;
    });
});

Cypress.Commands.add("setAccountData", (type: string, data: object): Chainable<{}> => {
    return cy.getClient().then(async (cli: MatrixClient) => {
        return cli.setAccountData(type, data);
    });
});

Cypress.Commands.add(
    "sendEvent",
    (roomId: string, threadId: string | null, eventType: string, content: IContent): Chainable<ISendEventResponse> => {
        return cy.getClient().then(async (cli: MatrixClient) => {
            return cli.sendEvent(roomId, threadId, eventType, content);
        });
    },
);

Cypress.Commands.add(
    "sendReadReceipt",
    (event: MatrixEvent, receiptType?: ReceiptType, unthreaded?: boolean): Chainable<{}> => {
        return cy.getClient().then(async (cli: MatrixClient) => {
            return cli.sendReadReceipt(event, receiptType, unthreaded);
        });
    },
);

Cypress.Commands.add("setDisplayName", (name: string): Chainable<{}> => {
    return cy.getClient().then(async (cli: MatrixClient) => {
        return cli.setDisplayName(name);
    });
});

Cypress.Commands.add("uploadContent", (file: FileType, opts?: UploadOpts): Chainable<Awaited<Upload["promise"]>> => {
    return cy.getClient().then(async (cli: MatrixClient) => {
        return cli.uploadContent(file, opts);
    });
});

Cypress.Commands.add("setAvatarUrl", (url: string): Chainable<{}> => {
    return cy.getClient().then(async (cli: MatrixClient) => {
        return cli.setAvatarUrl(url);
    });
});

Cypress.Commands.add("bootstrapCrossSigning", (credentials: UserCredentials) => {
    cy.window({ log: false }).then((win) => {
        win.mxMatrixClientPeg.matrixClient.bootstrapCrossSigning({
            authUploadDeviceSigningKeys: async (func) => {
                await func({
                    type: "m.login.password",
                    identifier: {
                        type: "m.id.user",
                        user: credentials.userId,
                    },
                    password: credentials.password,
                });
            },
        });
    });
});

Cypress.Commands.add("joinRoom", (roomIdOrAlias: string): Chainable<Room> => {
    return cy.getClient().then((cli) => cli.joinRoom(roomIdOrAlias));
});
