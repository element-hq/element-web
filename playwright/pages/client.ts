/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type JSHandle, type Page } from "@playwright/test";
import { type PageFunctionOn } from "playwright-core/types/structs";

import { Network } from "./network";
import type {
    IContent,
    ICreateRoomOpts,
    ISendEventResponse,
    MatrixClient,
    MatrixEvent,
    ReceiptType,
    IRoomDirectoryOptions,
    KnockRoomOpts,
    Visibility,
    UploadOpts,
    Upload,
    StateEvents,
    TimelineEvents,
    AccountDataEvents,
    EmptyObject,
} from "matrix-js-sdk/src/matrix";
import type { RoomMessageEventContent } from "matrix-js-sdk/src/types";
import { type Credentials } from "../plugins/homeserver";

export class Client {
    public network: Network;
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
        this.network = new Network(page, this);
    }

    public async cleanup() {
        await this.network.destroyRoute();
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

    public evaluateHandle<R, Arg, O extends MatrixClient = MatrixClient>(
        pageFunction: PageFunctionOn<O, Arg, R>,
        arg: Arg,
    ): Promise<JSHandle<R>>;
    public evaluateHandle<R, O extends MatrixClient = MatrixClient>(
        pageFunction: PageFunctionOn<O, void, R>,
        arg?: any,
    ): Promise<JSHandle<R>>;
    public async evaluateHandle<T>(fn: (client: MatrixClient) => T, arg?: any): Promise<JSHandle<T>> {
        await this.prepareClient();
        return this.client.evaluateHandle(fn, arg);
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
                return client.sendEvent(
                    roomId,
                    threadId,
                    eventType as keyof TimelineEvents,
                    content as TimelineEvents[keyof TimelineEvents],
                );
            },
            { roomId, threadId, eventType, content },
        );
    }

    /**
     * Send a message into a room
     * @param roomId ID of the room to send the message into
     * @param content the event content to send
     * @param threadId optional thread id
     */
    public async sendMessage(
        roomId: string,
        content: IContent | string,
        threadId: string | null = null,
    ): Promise<ISendEventResponse> {
        if (typeof content === "string") {
            content = {
                msgtype: "m.text",
                body: content,
            };
        }

        const client = await this.prepareClient();
        return client.evaluate(
            (client, { roomId, content, threadId }) => {
                return client.sendMessage(roomId, threadId, content as RoomMessageEventContent);
            },
            {
                roomId,
                content,
                threadId,
            },
        );
    }

    public async redactEvent(roomId: string, eventId: string, reason?: string): Promise<ISendEventResponse> {
        return this.evaluate(
            async (client, { roomId, eventId, reason }) => {
                return client.redactEvent(roomId, eventId, reason);
            },
            { roomId, eventId, reason },
        );
    }

    /**
     * Send a reaction to to a message
     * @param roomId ID of the room to send the reaction into
     * @param threadId ID of the thread to send into or null for main timeline
     * @param eventId Event ID of the message you are reacting to
     * @param reaction The reaction text to send
     * @returns
     */
    public async reactToMessage(
        roomId: string,
        threadId: string | null,
        eventId: string,
        reaction: string,
    ): Promise<ISendEventResponse> {
        return this.sendEvent(roomId, threadId ?? null, "m.reaction", {
            "m.relates_to": {
                rel_type: "m.annotation",
                event_id: eventId,
                key: reaction,
            },
        });
    }

    /**
     * Create a room with given options.
     * @param options the options to apply when creating the room
     * @return the ID of the newly created room
     */
    public async createRoom(options: ICreateRoomOpts): Promise<string> {
        const client = await this.prepareClient();
        const roomId = await client.evaluate(async (cli, options) => {
            const { room_id: roomId } = await cli.createRoom(options);
            return roomId;
        }, options);
        await this.awaitRoomMembership(roomId);
        return roomId;
    }

    /**
     * Create a space with given options.
     * @param options the options to apply when creating the space
     * @return the ID of the newly created space (room)
     */
    public async createSpace(options: ICreateRoomOpts): Promise<string> {
        return this.createRoom({
            ...options,
            creation_content: {
                ...options.creation_content,
                type: "m.space",
            },
        });
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
    public async joinRoomByName(roomName: string): Promise<string> {
        const client = await this.prepareClient();
        return client.evaluate(
            async (client, { roomName }) => {
                const room = client.getRooms().find((r) => r.getDefaultRoomName(client.getUserId()) === roomName);
                if (room) {
                    await client.joinRoom(room.roomId);
                    return room.roomId;
                }
                throw new Error(`Bot room join failed. Cannot find room '${roomName}'`);
            },
            {
                roomName,
            },
        );
    }

    /**
     * Wait until next sync from this client
     */
    public async waitForNextSync(): Promise<void> {
        await this.page.waitForResponse(async (response) => {
            const accessToken = await this.evaluate((client) => client.getAccessToken());
            const authHeader = await response.request().headerValue("authorization");
            return response.url().includes("/sync") && authHeader.includes(accessToken);
        });
    }

    /**
     * Invites the given user to the given room.
     * @param roomId the id of the room to invite to
     * @param userId the id of the user to invite
     */
    public async inviteUser(roomId: string, userId: string): Promise<void> {
        const client = await this.prepareClient();
        await client.evaluate((client, { roomId, userId }) => client.invite(roomId, userId), {
            roomId,
            userId,
        });
    }

    /**
     * Knocks the given room.
     * @param roomId the id of the room to knock
     * @param opts the options to use when knocking
     */
    public async knockRoom(roomId: string, opts?: KnockRoomOpts): Promise<void> {
        const client = await this.prepareClient();
        await client.evaluate((client, { roomId, opts }) => client.knockRoom(roomId, opts), { roomId, opts });
    }

    /**
     * Kicks the given user from the given room.
     * @param roomId the id of the room to kick from
     * @param userId the id of the user to kick
     * @param reason the reason for the kick
     */
    public async kick(roomId: string, userId: string, reason?: string): Promise<void> {
        const client = await this.prepareClient();
        await client.evaluate((client, { roomId, userId, reason }) => client.kick(roomId, userId, reason), {
            roomId,
            userId,
            reason,
        });
    }

    /**
     * Bans the given user from the given room.
     * @param roomId the id of the room to ban from
     * @param userId the id of the user to ban
     * @param reason the reason for the ban
     */
    public async ban(roomId: string, userId: string, reason?: string): Promise<void> {
        const client = await this.prepareClient();
        await client.evaluate((client, { roomId, userId, reason }) => client.ban(roomId, userId, reason), {
            roomId,
            userId,
            reason,
        });
    }

    /**
     * Unban the given user from the given room.
     * @param roomId the id of the room to unban from
     * @param userId the id of the user to unban
     */
    public async unban(roomId: string, userId: string): Promise<void> {
        const client = await this.prepareClient();
        await client.evaluate((client, { roomId, userId }) => client.unban(roomId, userId), { roomId, userId });
    }

    /**
     * Wait for the client to have specific membership of a given room
     *
     * This is often useful after joining a room, when we need to wait for the sync loop to catch up.
     *
     * Times out with an error after 1 second.
     *
     * @param roomId - ID of the room to check
     * @param membership - required membership.
     */
    public async awaitRoomMembership(roomId: string, membership: string = "join") {
        await this.evaluate(
            (cli: MatrixClient, { roomId, membership }) => {
                const isReady = () => {
                    // Fetch the room on each check, because we get a different instance before and after the join arrives.
                    const room = cli.getRoom(roomId);
                    const myMembership = room?.getMyMembership();
                    // @ts-ignore access to private field "logger"
                    cli.logger.info(`waiting for room ${roomId}: membership now ${myMembership}`);
                    return myMembership === membership;
                };
                if (isReady()) return;

                const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 1000)).then(() => {
                    const room = cli.getRoom(roomId);
                    const myMembership = room?.getMyMembership();
                    throw new Error(
                        `Timeout waiting for room ${roomId} membership (now '${myMembership}', wanted '${membership}')`,
                    );
                });

                const readyPromise = new Promise<void>((resolve) => {
                    async function onEvent() {
                        if (isReady()) {
                            cli.removeListener(window.matrixcs.ClientEvent.Event, onEvent);
                            resolve();
                        }
                    }

                    cli.on(window.matrixcs.ClientEvent.Event, onEvent);
                });

                return Promise.race([timeoutPromise, readyPromise]);
            },
            { roomId, membership },
        );
    }

    /**
     * @param {MatrixEvent} event
     * @param {ReceiptType} receiptType
     * @param {boolean} unthreaded
     */
    public async sendReadReceipt(
        event: JSHandle<MatrixEvent>,
        receiptType?: ReceiptType,
        unthreaded?: boolean,
    ): Promise<EmptyObject> {
        const client = await this.prepareClient();
        return client.evaluate(
            (client, { event, receiptType, unthreaded }) => {
                return client.sendReadReceipt(event, receiptType, unthreaded);
            },
            { event, receiptType, unthreaded },
        );
    }

    public async publicRooms(options?: IRoomDirectoryOptions): ReturnType<MatrixClient["publicRooms"]> {
        const client = await this.prepareClient();
        return client.evaluate((client, options) => {
            return client.publicRooms(options);
        }, options);
    }

    /**
     * @param {string} name
     * @param {module:client.callback} callback Optional.
     * @return {Promise} Resolves: {} an empty object.
     * @return {module:http-api.MatrixError} Rejects: with an error response.
     */
    public async setDisplayName(name: string): Promise<EmptyObject> {
        const client = await this.prepareClient();
        return client.evaluate(async (cli: MatrixClient, name) => cli.setDisplayName(name), name);
    }

    /**
     * @param {string} url
     * @param {module:client.callback} callback Optional.
     * @return {Promise} Resolves: {} an empty object.
     * @return {module:http-api.MatrixError} Rejects: with an error response.
     */
    public async setAvatarUrl(url: string): Promise<EmptyObject> {
        const client = await this.prepareClient();
        return client.evaluate(async (cli: MatrixClient, url) => cli.setAvatarUrl(url), url);
    }

    /**
     * Upload a file to the media repository on the homeserver.
     *
     * @param {object} file The object to upload. On a browser, something that
     *   can be sent to XMLHttpRequest.send (typically a File).  Under node.js,
     *   a Buffer, String or ReadStream.
     */
    public async uploadContent(file: Buffer, opts?: UploadOpts): Promise<Awaited<Upload["promise"]>> {
        const client = await this.prepareClient();
        return client.evaluate(
            async (cli: MatrixClient, { file, opts }) => cli.uploadContent(new Uint8Array(file), opts),
            {
                file: [...file],
                opts,
            },
        );
    }

    /**
     * Bootstraps cross-signing.
     */
    public async bootstrapCrossSigning(credentials: Credentials): Promise<void> {
        const client = await this.prepareClient();
        return bootstrapCrossSigningForClient(client, credentials);
    }

    /**
     * Sets account data for the user.
     * @param type The type of account data to set
     * @param content The content to set
     */
    public async setAccountData<T extends keyof AccountDataEvents>(
        type: T,
        content: AccountDataEvents[T],
    ): Promise<void> {
        const client = await this.prepareClient();
        return client.evaluate(
            async (client, { type, content }) => {
                await client.setAccountData(type as T, content as AccountDataEvents[T]);
            },
            { type, content },
        );
    }

    /**
     * Sends a state event into the room.
     * @param roomId ID of the room to send the event into
     * @param eventType type of event to send
     * @param content the event content to send
     * @param stateKey the state key to use
     */
    public async sendStateEvent(
        roomId: string,
        eventType: string,
        content: IContent,
        stateKey?: string,
    ): Promise<ISendEventResponse> {
        const client = await this.prepareClient();
        return client.evaluate(
            async (client, { roomId, eventType, content, stateKey }) => {
                return client.sendStateEvent(roomId, eventType as keyof StateEvents, content, stateKey);
            },
            { roomId, eventType, content, stateKey },
        );
    }

    /**
     * Leaves the given room.
     * @param roomId ID of the room to leave
     */
    public async leave(roomId: string): Promise<void> {
        const client = await this.prepareClient();
        return client.evaluate(async (client, roomId) => {
            await client.leave(roomId);
        }, roomId);
    }

    /**
     * Sets the directory visibility for a room.
     * @param roomId ID of the room to set the directory visibility for
     * @param visibility The new visibility for the room
     */
    public async setRoomDirectoryVisibility(roomId: string, visibility: Visibility): Promise<void> {
        const client = await this.prepareClient();
        return client.evaluate(
            async (client, { roomId, visibility }) => {
                await client.setRoomDirectoryVisibility(roomId, visibility);
            },
            { roomId, visibility },
        );
    }
}

/** Call `CryptoApi.bootstrapCrossSigning` on the given Matrix client, using the given credentials to authenticate
 * the UIA request.
 */
export function bootstrapCrossSigningForClient(
    client: JSHandle<MatrixClient>,
    credentials: Credentials,
    resetKeys: boolean = false,
) {
    return client.evaluate(
        async (client, { credentials, resetKeys }) => {
            await client.getCrypto().bootstrapCrossSigning({
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
                setupNewCrossSigning: resetKeys,
            });
        },
        { credentials, resetKeys },
    );
}
