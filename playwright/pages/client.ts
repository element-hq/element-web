/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { JSHandle, Page } from "@playwright/test";
import { PageFunctionOn } from "playwright-core/types/structs";

import type { IContent, ICreateRoomOpts, ISendEventResponse, MatrixClient, Room } from "matrix-js-sdk/src/matrix";

export class Client {
    protected client: JSHandle<MatrixClient>;

    protected getClientHandle(): Promise<JSHandle<MatrixClient>> {
        return this.page.evaluateHandle(() => window.mxMatrixClientPeg.get());
    }

    public async prepareClient(): Promise<JSHandle<MatrixClient>> {
        if (!this.client) {
            this.client = await this.getClientHandle();
        }
        return this.client;
    }

    public constructor(protected readonly page: Page) {
        page.on("framenavigated", async () => {
            this.client = null;
        });
    }

    public evaluate<R, Arg, O extends MatrixClient = MatrixClient>(
        pageFunction: PageFunctionOn<O, Arg, R>,
        arg: Arg,
    ): Promise<R>;
    public evaluate<R, O extends MatrixClient = MatrixClient>(
        pageFunction: PageFunctionOn<O, void, R>,
        arg?: any,
    ): Promise<R>;
    public async evaluate<T>(fn: (client: MatrixClient) => T, arg?: any): Promise<T> {
        await this.prepareClient();
        return this.client.evaluate(fn, arg);
    }

    /**
     * @param roomId ID of the room to send the event into
     * @param threadId ID of the thread to send into or null for main timeline
     * @param eventType type of event to send
     * @param content the event content to send
     */
    public async sendEvent(
        roomId: string,
        threadId: string | null,
        eventType: string,
        content: IContent,
    ): Promise<ISendEventResponse> {
        const client = await this.prepareClient();
        return client.evaluate(
            async (client, { roomId, threadId, eventType, content }) => {
                return client.sendEvent(roomId, threadId, eventType, content);
            },
            { roomId, threadId, eventType, content },
        );
    }

    /**
     * Send a message as a bot into a room
     * @param roomId ID of the room to send the message into
     * @param content the event content to send
     */
    public async sendMessage(roomId: string, content: IContent): Promise<ISendEventResponse> {
        const client = await this.prepareClient();
        return client.evaluate(
            (client, { roomId, content }) => {
                return client.sendMessage(roomId, content);
            },
            {
                roomId,
                content,
            },
        );
    }

    /**
     * Create a room with given options.
     * @param options the options to apply when creating the room
     * @return the ID of the newly created room
     */
    public async createRoom(options: ICreateRoomOpts): Promise<string> {
        const client = await this.prepareClient();
        return await client.evaluate(async (cli, options) => {
            const resp = await cli.createRoom(options);
            const roomId = resp.room_id;
            if (!cli.getRoom(roomId)) {
                await new Promise<void>((resolve) => {
                    const onRoom = (room: Room) => {
                        if (room.roomId === roomId) {
                            cli.off(window.matrixcs.ClientEvent.Room, onRoom);
                            resolve();
                        }
                    };
                    cli.on(window.matrixcs.ClientEvent.Room, onRoom);
                });
            }
            return roomId;
        }, options);
    }

    /**
     * Joins the given room by alias or ID
     * @param roomIdOrAlias the id or alias of the room to join
     */
    public async joinRoom(roomIdOrAlias: string): Promise<void> {
        const client = await this.prepareClient();
        await client.evaluate(async (client, roomIdOrAlias) => {
            return await client.joinRoom(roomIdOrAlias);
        }, roomIdOrAlias);
    }

    /**
     * Make this bot join a room by name
     * @param roomName Name of the room to join
     */
    public async joinRoomByName(roomName: string): Promise<void> {
        const client = await this.prepareClient();
        await client.evaluate(
            (client, { roomName }) => {
                const room = client.getRooms().find((r) => r.getDefaultRoomName(client.getUserId()) === roomName);
                if (room) {
                    return client.joinRoom(room.roomId);
                }
                throw new Error(`Bot room join failed. Cannot find room '${roomName}'`);
            },
            {
                roomName,
            },
        );
    }
}
