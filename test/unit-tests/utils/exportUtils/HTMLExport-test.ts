/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    EventTimeline,
    type EventTimelineSet,
    EventType,
    type IRoomEvent,
    type MatrixClient,
    MatrixEvent,
    MsgType,
    Relations,
    RelationType,
    Room,
    RoomMember,
    RoomState,
} from "matrix-js-sdk/src/matrix";
import fetchMock from "fetch-mock-jest";
import escapeHtml from "escape-html";
import { type RelationsContainer } from "matrix-js-sdk/src/models/relations-container";

import { filterConsole, mkReaction, mkStubRoom, REPEATABLE_DATE, stubClient } from "../../../test-utils";
import { ExportType, type IExportOptions } from "../../../../src/utils/exportUtils/exportUtils";
import SdkConfig from "../../../../src/SdkConfig";
import HTMLExporter from "../../../../src/utils/exportUtils/HtmlExport";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { mediaFromMxc } from "../../../../src/customisations/Media";

jest.mock("jszip");

const EVENT_MESSAGE: IRoomEvent = {
    event_id: "$1",
    type: EventType.RoomMessage,
    sender: "@bob:example.com",
    origin_server_ts: 0,
    content: {
        msgtype: "m.text",
        body: "Message",
        avatar_url: "mxc://example.org/avatar.bmp",
    },
};

const EVENT_ATTACHMENT: IRoomEvent = {
    event_id: "$2",
    type: EventType.RoomMessage,
    sender: "@alice:example.com",
    origin_server_ts: 1,
    content: {
        msgtype: MsgType.File,
        body: "hello.txt",
        filename: "hello.txt",
        url: "mxc://example.org/test-id",
    },
};

const EVENT_ATTACHMENT_MALFORMED: IRoomEvent = {
    event_id: "$2",
    type: EventType.RoomMessage,
    sender: "@alice:example.com",
    origin_server_ts: 1,
    content: {
        msgtype: MsgType.File,
        body: "hello.txt",
        file: {
            url: undefined,
        },
    },
};

describe("HTMLExport", () => {
    let client: jest.Mocked<MatrixClient>;
    let room: Room;

    filterConsole(
        "Starting export",
        "events in", // Fetched # events in # seconds
        "events so far",
        "Export successful!",
        "does not have an m.room.create event",
        "Creating HTML",
        "Generating a ZIP",
        "Cleaning up",
    );

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(REPEATABLE_DATE);

        client = stubClient() as jest.Mocked<MatrixClient>;
        DMRoomMap.makeShared(client);

        room = new Room("!myroom:example.org", client, "@me:example.org");
        client.getRoom.mockReturnValue(room);
    });

    function mockMessages(...events: IRoomEvent[]): void {
        client.createMessagesRequest.mockImplementation((_roomId, fromStr, limit = 30) => {
            const from = fromStr === null ? 0 : parseInt(fromStr);
            const chunk = events.slice(from, limit);
            return Promise.resolve({
                chunk,
                from: from.toString(),
                to: (from + limit).toString(),
            });
        });
    }

    /** Retrieve a map of files within the zip. */
    function getFiles(exporter: HTMLExporter): { [filename: string]: Blob } {
        //@ts-ignore private access
        const files = exporter.files;
        return files.reduce((d, f) => ({ ...d, [f.name]: f.blob }), {});
    }

    function getMessageFile(exporter: HTMLExporter): Blob {
        const files = getFiles(exporter);
        return files["messages.html"]!;
    }

    /** set a mock fetch response for an MXC */
    function mockMxc(mxc: string, body: string) {
        const media = mediaFromMxc(mxc, client);
        fetchMock.get(media.srcHttp!, body);
    }

    function mockReactionForMessage(message: IRoomEvent): MatrixEvent {
        const firstMessage = new MatrixEvent(message);
        const reaction = mkReaction(firstMessage);

        const relationsContainer = {
            getRelations: jest.fn(),
            getChildEventsForEvent: jest.fn(),
        } as unknown as RelationsContainer;
        const relations = new Relations(RelationType.Annotation, EventType.Reaction, client);
        relations.addEvent(reaction);
        relationsContainer.getChildEventsForEvent = jest
            .fn()
            .mockImplementation(
                (eventId: string, relationType: RelationType | string, eventType: EventType | string) => {
                    if (eventId === firstMessage.getId()) {
                        return relations;
                    }
                },
            );

        const timelineSet = {
            relations: relationsContainer,
            getLiveTimeline: () => timeline,
        } as unknown as EventTimelineSet;
        const timeline = new EventTimeline(timelineSet);
        room.getUnfilteredTimelineSet = jest.fn().mockReturnValue(timelineSet);
        return reaction;
    }

    it("should throw when created with invalid config for LastNMessages", async () => {
        expect(
            () =>
                new HTMLExporter(
                    room,
                    ExportType.LastNMessages,
                    {
                        attachmentsIncluded: false,
                        maxSize: 1_024 * 1_024,
                        numberOfMessages: undefined,
                    },
                    () => {},
                ),
        ).toThrow("Invalid export options");
    });

    it("should have an SDK-branded destination file name", () => {
        const roomName = "My / Test / Room: Welcome";
        const stubOptions: IExportOptions = {
            attachmentsIncluded: false,
            maxSize: 50000000,
            numberOfMessages: 40,
        };
        const stubRoom = mkStubRoom("!myroom:example.org", roomName, client);
        const exporter = new HTMLExporter(stubRoom, ExportType.LastNMessages, stubOptions, () => {});

        expect(exporter.destinationFileName).toMatchSnapshot();

        SdkConfig.put({ brand: "BrandedChat/WithSlashes/ForFun" });

        expect(exporter.destinationFileName).toMatchSnapshot();
    });

    it("should export", async () => {
        const events = [...Array(50)].map<IRoomEvent>((_, i) => ({
            event_id: `${i}`,
            type: EventType.RoomMessage,
            sender: `@user${i}:example.com`,
            origin_server_ts: 5_000 + i * 1000,
            content: {
                msgtype: "m.text",
                body: `Message #${i}`,
            },
        }));
        mockReactionForMessage(events[0]);
        mockMessages(...events);

        const exporter = new HTMLExporter(
            room,
            ExportType.LastNMessages,
            {
                attachmentsIncluded: false,
                maxSize: 1_024 * 1_024,
                numberOfMessages: events.length,
            },
            () => {},
        );

        await exporter.export();

        const file = getMessageFile(exporter);
        expect(await file.text()).toMatchSnapshot();
    });

    it("should include the room's avatar", async () => {
        mockMessages(EVENT_MESSAGE);

        const mxc = "mxc://www.example.com/avatars/nice-room.jpeg";
        const avatar = "011011000110111101101100";
        jest.spyOn(room, "getMxcAvatarUrl").mockReturnValue(mxc);
        mockMxc(mxc, avatar);

        const exporter = new HTMLExporter(
            room,
            ExportType.LastNMessages,
            {
                attachmentsIncluded: false,
                maxSize: 1_024 * 1_024,
                numberOfMessages: 40,
            },
            () => {},
        );

        await exporter.export();

        const files = getFiles(exporter);
        expect(await files["room.png"]!.text()).toBe(avatar);
    });

    it("should include the creation event", async () => {
        const creator = "@bob:example.com";
        mockMessages(EVENT_MESSAGE);
        room.currentState.setStateEvents([
            new MatrixEvent({
                type: EventType.RoomCreate,
                event_id: "$00001",
                room_id: room.roomId,
                sender: creator,
                origin_server_ts: 0,
                content: {},
                state_key: "",
            }),
        ]);

        const exporter = new HTMLExporter(
            room,
            ExportType.LastNMessages,
            {
                attachmentsIncluded: false,
                maxSize: 1_024 * 1_024,
                numberOfMessages: 40,
            },
            () => {},
        );

        await exporter.export();

        expect(await getMessageFile(exporter).text()).toContain(`${creator} created this room.`);
    });

    it("should include the topic", async () => {
        const topic = ":^-) (-^:";
        mockMessages(EVENT_MESSAGE);
        room.currentState.setStateEvents([
            new MatrixEvent({
                type: EventType.RoomTopic,
                event_id: "$00001",
                room_id: room.roomId,
                sender: "@alice:example.com",
                origin_server_ts: 0,
                content: { topic },
                state_key: "",
            }),
        ]);

        const exporter = new HTMLExporter(
            room,
            ExportType.LastNMessages,
            {
                attachmentsIncluded: false,
                maxSize: 1_024 * 1_024,
                numberOfMessages: 40,
            },
            () => {},
        );

        await exporter.export();

        expect(await getMessageFile(exporter).text()).toContain(`Topic: ${topic}`);
    });

    it("should include avatars", async () => {
        mockMessages(EVENT_MESSAGE);

        jest.spyOn(RoomMember.prototype, "getMxcAvatarUrl").mockReturnValue("mxc://example.org/avatar.bmp");

        const avatarContent = "this is a bitmap all the pixels are red :^-)";
        mockMxc("mxc://example.org/avatar.bmp", avatarContent);

        const exporter = new HTMLExporter(
            room,
            ExportType.LastNMessages,
            {
                attachmentsIncluded: false,
                maxSize: 1_024 * 1_024,
                numberOfMessages: 40,
            },
            () => {},
        );

        await exporter.export();

        // Ensure that the avatar is present
        const files = getFiles(exporter);
        const file = files["users/@bob-example.com.png"];
        expect(file).not.toBeUndefined();

        // Ensure it has the expected content
        expect(await file.text()).toBe(avatarContent);
    });

    it("should handle when an event has no sender", async () => {
        const EVENT_MESSAGE_NO_SENDER: IRoomEvent = {
            event_id: "$1",
            type: EventType.RoomMessage,
            sender: "",
            origin_server_ts: 0,
            content: {
                msgtype: "m.text",
                body: "Message with no sender",
            },
        };
        mockMessages(EVENT_MESSAGE_NO_SENDER);

        const exporter = new HTMLExporter(
            room,
            ExportType.LastNMessages,
            {
                attachmentsIncluded: false,
                maxSize: 1_024 * 1_024,
                numberOfMessages: 40,
            },
            () => {},
        );

        await exporter.export();

        const file = getMessageFile(exporter);
        expect(await file.text()).toContain(EVENT_MESSAGE_NO_SENDER.content.body);
    });

    it("should handle when events sender cannot be found in room state", async () => {
        mockMessages(EVENT_MESSAGE);

        jest.spyOn(RoomState.prototype, "getSentinelMember").mockReturnValue(null);

        const exporter = new HTMLExporter(
            room,
            ExportType.LastNMessages,
            {
                attachmentsIncluded: false,
                maxSize: 1_024 * 1_024,
                numberOfMessages: 40,
            },
            () => {},
        );

        await exporter.export();

        const file = getMessageFile(exporter);
        expect(await file.text()).toContain(EVENT_MESSAGE.content.body);
    });

    it("should include attachments", async () => {
        mockMessages(EVENT_MESSAGE, EVENT_ATTACHMENT);
        const attachmentBody = "Lorem ipsum dolor sit amet";

        mockMxc("mxc://example.org/test-id", attachmentBody);

        const exporter = new HTMLExporter(
            room,
            ExportType.LastNMessages,
            {
                attachmentsIncluded: true,
                maxSize: 1_024 * 1_024,
                numberOfMessages: 40,
            },
            () => {},
        );

        await exporter.export();

        // Ensure that the attachment is present
        const files = getFiles(exporter);
        const file = files[Object.keys(files).find((k) => k.endsWith(".txt"))!];
        expect(file).not.toBeUndefined();

        // Ensure that the attachment has the expected content
        const text = await file.text();
        expect(text).toBe(attachmentBody);
    });

    it("should handle when attachment cannot be fetched", async () => {
        mockMessages(EVENT_MESSAGE, EVENT_ATTACHMENT_MALFORMED, EVENT_ATTACHMENT);
        const attachmentBody = "Lorem ipsum dolor sit amet";

        mockMxc("mxc://example.org/test-id", attachmentBody);

        const exporter = new HTMLExporter(
            room,
            ExportType.LastNMessages,
            {
                attachmentsIncluded: true,
                maxSize: 1_024 * 1_024,
                numberOfMessages: 40,
            },
            () => {},
        );

        await exporter.export();

        // good attachment present
        const files = getFiles(exporter);
        const file = files[Object.keys(files).find((k) => k.endsWith(".txt"))!];
        expect(file).not.toBeUndefined();

        // Ensure that the attachment has the expected content
        const text = await file.text();
        expect(text).toBe(attachmentBody);

        // messages export still successful
        const messagesFile = getMessageFile(exporter);
        expect(await messagesFile.text()).toBeTruthy();
    });

    it("should handle when attachment srcHttp is falsy", async () => {
        mockMessages(EVENT_MESSAGE, EVENT_ATTACHMENT);
        const attachmentBody = "Lorem ipsum dolor sit amet";

        mockMxc("mxc://example.org/test-id", attachmentBody);

        jest.spyOn(client, "mxcUrlToHttp").mockReturnValue(null);

        const exporter = new HTMLExporter(
            room,
            ExportType.LastNMessages,
            {
                attachmentsIncluded: true,
                maxSize: 1_024 * 1_024,
                numberOfMessages: 40,
            },
            () => {},
        );

        await exporter.export();

        // attachment not present
        const files = getFiles(exporter);
        const file = files[Object.keys(files).find((k) => k.endsWith(".txt"))!];
        expect(file).toBeUndefined();

        // messages export still successful
        const messagesFile = getMessageFile(exporter);
        expect(await messagesFile.text()).toBeTruthy();
    });

    it("should omit attachments", async () => {
        mockMessages(EVENT_MESSAGE, EVENT_ATTACHMENT);

        const exporter = new HTMLExporter(
            room,
            ExportType.LastNMessages,
            {
                attachmentsIncluded: false,
                maxSize: 1_024 * 1_024,
                numberOfMessages: 40,
            },
            () => {},
        );

        await exporter.export();

        // Ensure that the attachment is present
        const files = getFiles(exporter);
        for (const fileName of Object.keys(files)) {
            expect(fileName).not.toMatch(/^files\/hello/);
        }
    });

    it("should add link to next and previous file", async () => {
        const exporter = new HTMLExporter(
            room,
            ExportType.LastNMessages,
            {
                attachmentsIncluded: false,
                maxSize: 1_024 * 1_024,
                numberOfMessages: 5000,
            },
            () => {},
        );

        // test link to the first page
        //@ts-ignore private access
        let result = await exporter.wrapHTML("", 0, 3);
        expect(result).not.toContain("Previous group of messages");
        expect(result).toContain(
            '<div style="text-align:center;margin:10px"><a href="./messages2.html" style="font-weight:bold">Next group of messages</a></div>',
        );

        // test link for a middle page
        //@ts-ignore private access
        result = await exporter.wrapHTML("", 1, 3);
        expect(result).toContain(
            '<div style="text-align:center"><a href="./messages.html" style="font-weight:bold">Previous group of messages</a></div>',
        );
        expect(result).toContain(
            '<div style="text-align:center;margin:10px"><a href="./messages3.html" style="font-weight:bold">Next group of messages</a></div>',
        );

        // test link for last page
        //@ts-ignore private access
        result = await exporter.wrapHTML("", 2, 3);
        expect(result).toContain(
            '<div style="text-align:center"><a href="./messages2.html" style="font-weight:bold">Previous group of messages</a></div>',
        );
        expect(result).not.toContain("Next group of messages");
    });

    it("should not leak javascript from room names or topics", async () => {
        const name = "<svg onload=alert(3)>";
        const topic = "<svg onload=alert(5)>";
        mockMessages(EVENT_MESSAGE);
        room.currentState.setStateEvents([
            new MatrixEvent({
                type: EventType.RoomName,
                event_id: "$00001",
                room_id: room.roomId,
                sender: "@alice:example.com",
                origin_server_ts: 0,
                content: { name },
                state_key: "",
            }),
            new MatrixEvent({
                type: EventType.RoomTopic,
                event_id: "$00002",
                room_id: room.roomId,
                sender: "@alice:example.com",
                origin_server_ts: 1,
                content: { topic },
                state_key: "",
            }),
        ]);
        room.recalculate();

        const exporter = new HTMLExporter(
            room,
            ExportType.LastNMessages,
            {
                attachmentsIncluded: false,
                maxSize: 1_024 * 1_024,
                numberOfMessages: 40,
            },
            () => {},
        );

        await exporter.export();
        const html = await getMessageFile(exporter).text();

        expect(html).not.toContain(`${name}`);
        expect(html).toContain(`${escapeHtml(name)}`);
        expect(html).not.toContain(`${topic}`);
        expect(html).toContain(`Topic: ${escapeHtml(topic)}`);
    });

    it("should not make /messages requests when exporting 'Current Timeline'", async () => {
        client.createMessagesRequest.mockRejectedValue(new Error("Should never be called"));
        room.addLiveEvents(
            [
                new MatrixEvent({
                    event_id: `$eventId`,
                    type: EventType.RoomMessage,
                    sender: client.getSafeUserId(),
                    origin_server_ts: 123456789,
                    content: {
                        msgtype: "m.text",
                        body: `testing testing`,
                    },
                }),
            ],
            { addToState: true },
        );

        const exporter = new HTMLExporter(
            room,
            ExportType.Timeline,
            {
                attachmentsIncluded: false,
                maxSize: 1_024 * 1_024,
            },
            () => {},
        );

        await exporter.export();

        const file = getMessageFile(exporter);
        expect(await file.text()).toContain("testing testing");
        expect(client.createMessagesRequest).not.toHaveBeenCalled();
    });

    it("should include reactions", async () => {
        const reaction = mockReactionForMessage(EVENT_MESSAGE);
        mockMessages(EVENT_MESSAGE);
        const exporter = new HTMLExporter(
            room,
            ExportType.LastNMessages,
            {
                attachmentsIncluded: false,
                maxSize: 1_024 * 1_024,
                numberOfMessages: 40,
            },
            () => {},
        );

        await exporter.export();

        const file = getMessageFile(exporter);
        expect(await file.text()).toContain(reaction.getContent()["m.relates_to"]?.key);
    });
});
