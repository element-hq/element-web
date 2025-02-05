/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render } from "jest-matrix-react";
import {
    type IContent,
    type MatrixClient,
    MatrixEvent,
    Room,
    type RoomMember,
    RelationType,
    EventType,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { type IExportOptions, ExportType, ExportFormat } from "../../../src/utils/exportUtils/exportUtils";
import PlainTextExporter from "../../../src/utils/exportUtils/PlainTextExport";
import HTMLExporter from "../../../src/utils/exportUtils/HtmlExport";
import * as TestUtilsMatrix from "../../test-utils";
import { stubClient } from "../../test-utils";

let client: MatrixClient;

const MY_USER_ID = "@me:here";

function generateRoomId() {
    return "!" + Math.random().toString().slice(2, 10) + ":domain";
}

interface ITestContent extends IContent {
    expectedText: string;
}

describe("export", function () {
    const setProgressText = jest.fn();

    let mockExportOptions: IExportOptions;
    let mockRoom: Room;
    let ts0: number;
    let events: MatrixEvent[];
    beforeEach(() => {
        stubClient();
        client = MatrixClientPeg.safeGet();
        client.getUserId = () => {
            return MY_USER_ID;
        };

        mockExportOptions = {
            numberOfMessages: 5,
            maxSize: 100 * 1024 * 1024,
            attachmentsIncluded: false,
        };

        function createRoom() {
            const room = new Room(generateRoomId(), client, client.getUserId()!);
            return room;
        }
        mockRoom = createRoom();
        ts0 = Date.now();
        events = mkEvents();
        jest.spyOn(client, "getRoom").mockReturnValue(mockRoom);
    });

    function mkRedactedEvent(i = 0) {
        return new MatrixEvent({
            type: "m.room.message",
            sender: MY_USER_ID,
            content: {},
            unsigned: {
                age: 72,
                transaction_id: "m1212121212.23",
                redacted_because: {
                    content: {},
                    origin_server_ts: ts0 + i * 1000,
                    redacts: "$9999999999999999999999999999999999999999998",
                    sender: "@me:here",
                    type: EventType.RoomRedaction,
                    unsigned: {
                        age: 94,
                        transaction_id: "m1111111111.1",
                    },
                    event_id: "$9999999999999999999999999999999999999999998",
                    room_id: mockRoom.roomId,
                },
            },
            event_id: "$9999999999999999999999999999999999999999999",
            room_id: mockRoom.roomId,
        });
    }

    function mkFileEvent() {
        return new MatrixEvent({
            content: {
                body: "index.html",
                info: {
                    mimetype: "text/html",
                    size: 31613,
                },
                msgtype: "m.file",
                url: "mxc://test.org",
            },
            origin_server_ts: 1628872988364,
            sender: MY_USER_ID,
            type: "m.room.message",
            unsigned: {
                age: 266,
                transaction_id: "m99999999.2",
            },
            event_id: "$99999999999999999999",
            room_id: mockRoom.roomId,
        });
    }

    function mkImageEvent() {
        return new MatrixEvent({
            content: {
                body: "image.png",
                info: {
                    mimetype: "image/png",
                    size: 31613,
                },
                msgtype: "m.image",
                url: "mxc://test.org",
            },
            origin_server_ts: 1628872988364,
            sender: MY_USER_ID,
            type: "m.room.message",
            unsigned: {
                age: 266,
                transaction_id: "m99999999.2",
            },
            event_id: "$99999999999999999999",
            room_id: mockRoom.roomId,
        });
    }

    function mkEvents() {
        const matrixEvents: MatrixEvent[] = [];
        let i: number;
        // plain text
        for (i = 0; i < 10; i++) {
            matrixEvents.push(
                TestUtilsMatrix.mkMessage({
                    event: true,
                    room: "!room:id",
                    user: "@user:id",
                    ts: ts0 + i * 1000,
                }),
            );
        }
        // reply events
        for (i = 0; i < 10; i++) {
            const eventId = "$" + Math.random() + "-" + Math.random();
            matrixEvents.push(
                TestUtilsMatrix.mkEvent({
                    content: {
                        "body": "> <@me:here> Hi\n\nTest",
                        "format": "org.matrix.custom.html",
                        "m.relates_to": {
                            "rel_type": RelationType.Reference,
                            "event_id": eventId,
                            "m.in_reply_to": {
                                event_id: eventId,
                            },
                        },
                        "msgtype": "m.text",
                    },
                    user: "@me:here",
                    type: "m.room.message",
                    room: mockRoom.roomId,
                    event: true,
                }),
            );
        }
        // membership events
        for (i = 0; i < 10; i++) {
            matrixEvents.push(
                TestUtilsMatrix.mkMembership({
                    event: true,
                    room: "!room:id",
                    user: "@user:id",
                    target: {
                        userId: "@user:id",
                        name: "Bob",
                        getAvatarUrl: () => {
                            return "avatar.jpeg";
                        },
                        getMxcAvatarUrl: () => "mxc://avatar.url/image.png",
                    } as unknown as RoomMember,
                    ts: ts0 + i * 1000,
                    mship: KnownMembership.Join,
                    prevMship: KnownMembership.Join,
                    name: "A user",
                }),
            );
        }
        // emote
        matrixEvents.push(
            TestUtilsMatrix.mkEvent({
                content: {
                    body: "waves",
                    msgtype: "m.emote",
                },
                user: "@me:here",
                type: "m.room.message",
                room: mockRoom.roomId,
                event: true,
            }),
        );
        // redacted events
        for (i = 0; i < 10; i++) {
            matrixEvents.push(mkRedactedEvent(i));
        }
        return matrixEvents;
    }

    function renderToString(elem: JSX.Element): string {
        return render(elem).container.outerHTML;
    }

    it("checks if the export format is valid", function () {
        function isValidFormat(format: string): boolean {
            const options: string[] = Object.values(ExportFormat);
            return options.includes(format);
        }
        expect(isValidFormat("Html")).toBeTruthy();
        expect(isValidFormat("Json")).toBeTruthy();
        expect(isValidFormat("PlainText")).toBeTruthy();
        expect(isValidFormat("Pdf")).toBeFalsy();
    });

    it("checks if the icons' html corresponds to export regex", function () {
        const exporter = new HTMLExporter(mockRoom, ExportType.Beginning, mockExportOptions, setProgressText);
        const fileRegex = /<span class="mx_MFileBody_info_icon">.*?<\/span>/;
        expect(fileRegex.test(renderToString(exporter.getEventTile(mkFileEvent(), true)))).toBeTruthy();
    });

    it("should export images if attachments are enabled", () => {
        const exporter = new HTMLExporter(
            mockRoom,
            ExportType.Beginning,
            {
                numberOfMessages: 5,
                maxSize: 100 * 1024 * 1024,
                attachmentsIncluded: true,
            },
            setProgressText,
        );
        const imageRegex = /<img.+ src="mxc:\/\/test.org" alt="image\.png"\/?>/;
        expect(imageRegex.test(renderToString(exporter.getEventTile(mkImageEvent(), true)))).toBeTruthy();
    });

    const invalidExportOptions: [string, IExportOptions][] = [
        [
            "numberOfMessages exceeds max",
            {
                numberOfMessages: 10 ** 9,
                maxSize: 1024 * 1024 * 1024,
                attachmentsIncluded: false,
            },
        ],
        [
            "maxSize exceeds 8GB",
            {
                numberOfMessages: -1,
                maxSize: 8001 * 1024 * 1024,
                attachmentsIncluded: false,
            },
        ],
        [
            "maxSize is less than 1mb",
            {
                numberOfMessages: 0,
                maxSize: 0,
                attachmentsIncluded: false,
            },
        ],
    ];
    it.each(invalidExportOptions)("%s", (_d, options) => {
        expect(() => new PlainTextExporter(mockRoom, ExportType.Beginning, options, setProgressText)).toThrow(
            "Invalid export options",
        );
    });

    it("tests the file extension splitter", function () {
        const exporter = new PlainTextExporter(mockRoom, ExportType.Beginning, mockExportOptions, setProgressText);
        const fileNameWithExtensions: Record<string, [string, string]> = {
            "": ["", ""],
            "name": ["name", ""],
            "name.txt": ["name", ".txt"],
            ".htpasswd": ["", ".htpasswd"],
            "name.with.many.dots.myext": ["name.with.many.dots", ".myext"],
        };
        for (const fileName in fileNameWithExtensions) {
            expect(exporter.splitFileName(fileName)).toStrictEqual(fileNameWithExtensions[fileName]);
        }
    });

    it("checks if the reply regex executes correctly", function () {
        const eventContents: ITestContent[] = [
            {
                msgtype: "m.text",
                body: "> <@me:here> Source\n\nReply",
                expectedText: '<@me:here "Source"> Reply',
            },
            {
                msgtype: "m.text",
                // if the reply format is invalid, then return the body
                body: "Invalid reply format",
                expectedText: "Invalid reply format",
            },
            {
                msgtype: "m.text",
                body: "> <@me:here> The source is more than 32 characters\n\nReply",
                expectedText: '<@me:here "The source is more than 32 chara..."> Reply',
            },
            {
                msgtype: "m.text",
                body: "> <@me:here> This\nsource\nhas\nnew\nlines\n\nReply",
                expectedText: '<@me:here "This"> Reply',
            },
        ];
        const exporter = new PlainTextExporter(mockRoom, ExportType.Beginning, mockExportOptions, setProgressText);
        for (const content of eventContents) {
            expect(exporter.textForReplyEvent(content)).toBe(content.expectedText);
        }
    });

    it("checks if the render to string doesn't throw any error for different types of events", function () {
        const exporter = new HTMLExporter(mockRoom, ExportType.Beginning, mockExportOptions, setProgressText);
        for (const event of events) {
            expect(renderToString(exporter.getEventTile(event, false))).toBeTruthy();
        }
    });
});
