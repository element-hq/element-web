/*
Copyright 2019, 2022 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { mocked, MockedObject } from "jest-mock";
import { render } from "@testing-library/react";
import * as prettier from "prettier";

import { getMockClientWithEventEmitter, mkEvent, mkMessage, mkStubRoom } from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import * as languageHandler from "../../../../src/languageHandler";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import TextualBody from "../../../../src/components/views/messages/TextualBody";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { RoomPermalinkCreator } from "../../../../src/utils/permalinks/Permalinks";
import { MediaEventHelper } from "../../../../src/utils/MediaEventHelper";

const room1Id = "!room1:example.com";
const room2Id = "!room2:example.com";
const room2Name = "Room 2";

interface MkRoomTextMessageOpts {
    roomId?: string;
}

const mkRoomTextMessage = (body: string, mkRoomTextMessageOpts?: MkRoomTextMessageOpts): MatrixEvent => {
    return mkMessage({
        msg: body,
        room: mkRoomTextMessageOpts?.roomId ?? room1Id,
        user: "sender",
        event: true,
    });
};

const mkFormattedMessage = (body: string, formattedBody: string): MatrixEvent => {
    return mkMessage({
        msg: body,
        formattedMsg: formattedBody,
        format: "org.matrix.custom.html",
        room: room1Id,
        user: "sender",
        event: true,
    });
};

describe("<TextualBody />", () => {
    afterEach(() => {
        jest.spyOn(MatrixClientPeg, "get").mockRestore();
        jest.spyOn(global.Math, "random").mockRestore();
    });

    const defaultRoom = mkStubRoom(room1Id, "test room", undefined);
    const otherRoom = mkStubRoom(room2Id, room2Name, undefined);
    let defaultMatrixClient: MockedObject<MatrixClient>;

    const defaultEvent = mkEvent({
        type: "m.room.message",
        room: room1Id,
        user: "sender",
        content: {
            body: "winks",
            msgtype: "m.emote",
        },
        event: true,
    });

    beforeEach(() => {
        defaultMatrixClient = getMockClientWithEventEmitter({
            getRoom: (roomId: string | undefined) => {
                if (roomId === room1Id) return defaultRoom;
                if (roomId === room2Id) return otherRoom;
                return null;
            },
            getRooms: () => [defaultRoom, otherRoom],
            getAccountData: (): MatrixEvent | undefined => undefined,
            isGuest: () => false,
            mxcUrlToHttp: (s: string) => s,
            getUserId: () => "@user:example.com",
            fetchRoomEvent: () => {
                throw new Error("MockClient event not found");
            },
        });

        mocked(defaultRoom).findEventById.mockImplementation((eventId: string) => {
            if (eventId === defaultEvent.getId()) return defaultEvent;
            return undefined;
        });
        jest.spyOn(global.Math, "random").mockReturnValue(0.123456);
    });

    const defaultProps = {
        mxEvent: defaultEvent,
        highlights: [] as string[],
        highlightLink: "",
        onMessageAllowed: jest.fn(),
        onHeightChanged: jest.fn(),
        permalinkCreator: new RoomPermalinkCreator(defaultRoom),
        mediaEventHelper: {} as MediaEventHelper,
    };

    const getComponent = (props = {}, matrixClient: MatrixClient = defaultMatrixClient, renderingFn?: any) =>
        (renderingFn ?? render)(
            <MatrixClientContext.Provider value={matrixClient}>
                <TextualBody {...defaultProps} {...props} />
            </MatrixClientContext.Provider>,
        );

    it("renders m.emote correctly", () => {
        DMRoomMap.makeShared(defaultMatrixClient);

        const ev = mkEvent({
            type: "m.room.message",
            room: room1Id,
            user: "sender",
            content: {
                body: "winks",
                msgtype: "m.emote",
            },
            event: true,
        });

        const { container } = getComponent({ mxEvent: ev });
        expect(container).toHaveTextContent("* sender winks");
        const content = container.querySelector(".mx_EventTile_body");
        expect(content).toContainHTML('<span class="mx_EventTile_body" dir="auto">winks</span>');
    });

    it("renders m.notice correctly", () => {
        DMRoomMap.makeShared(defaultMatrixClient);

        const ev = mkEvent({
            type: "m.room.message",
            room: room1Id,
            user: "bot_sender",
            content: {
                body: "this is a notice, probably from a bot",
                msgtype: "m.notice",
            },
            event: true,
        });

        const { container } = getComponent({ mxEvent: ev });
        expect(container).toHaveTextContent(ev.getContent().body);
        const content = container.querySelector(".mx_EventTile_body");
        expect(content).toContainHTML(`<span class="mx_EventTile_body" dir="auto">${ev.getContent().body}</span>`);
    });

    describe("renders plain-text m.text correctly", () => {
        beforeEach(() => {
            DMRoomMap.makeShared(defaultMatrixClient);
        });

        it("simple message renders as expected", () => {
            const ev = mkRoomTextMessage("this is a plaintext message");
            const { container } = getComponent({ mxEvent: ev });
            expect(container).toHaveTextContent(ev.getContent().body);
            const content = container.querySelector(".mx_EventTile_body");
            expect(content).toContainHTML(`<span class="mx_EventTile_body" dir="auto">${ev.getContent().body}</span>`);
        });

        // If pills were rendered within a Portal/same shadow DOM then it'd be easier to test
        it("linkification get applied correctly into the DOM", () => {
            const ev = mkRoomTextMessage("Visit https://matrix.org/");
            const { container } = getComponent({ mxEvent: ev });
            expect(container).toHaveTextContent(ev.getContent().body);
            const content = container.querySelector(".mx_EventTile_body");
            expect(content).toContainHTML(
                '<span class="mx_EventTile_body" dir="auto">' +
                    'Visit <a href="https://matrix.org/" class="linkified" target="_blank" rel="noreferrer noopener">' +
                    "https://matrix.org/</a></span>",
            );
        });

        it("should not pillify MXIDs", () => {
            const ev = mkRoomTextMessage("Chat with @user:example.com");
            const { container } = getComponent({ mxEvent: ev });
            const content = container.querySelector(".mx_EventTile_body");
            expect(content.innerHTML).toMatchInlineSnapshot(
                `"Chat with <a href="https://matrix.to/#/@user:example.com" class="linkified" rel="noreferrer noopener">@user:example.com</a>"`,
            );
        });

        it("should pillify an MXID permalink", () => {
            const ev = mkRoomTextMessage("Chat with https://matrix.to/#/@user:example.com");
            const { container } = getComponent({ mxEvent: ev });
            const content = container.querySelector(".mx_EventTile_body");
            expect(content.innerHTML).toMatchInlineSnapshot(
                `"Chat with <span><bdi><a class="mx_Pill mx_UserPill mx_UserPill_me" href="https://matrix.to/#/@user:example.com" aria-describedby="mx_Pill_0.123456"><img loading="lazy" class="mx_BaseAvatar mx_BaseAvatar_image" src="mxc://avatar.url/image.png" style="width: 16px; height: 16px;" alt="" data-testid="avatar-img" aria-hidden="true"><span class="mx_Pill_text">Member</span></a></bdi></span>"`,
            );
        });

        it("should not pillify room aliases", () => {
            const ev = mkRoomTextMessage("Visit #room:example.com");
            const { container } = getComponent({ mxEvent: ev });
            const content = container.querySelector(".mx_EventTile_body");
            expect(content.innerHTML).toMatchInlineSnapshot(
                `"Visit <a href="https://matrix.to/#/#room:example.com" class="linkified" rel="noreferrer noopener">#room:example.com</a>"`,
            );
        });

        it("should pillify a room alias permalink", () => {
            const ev = mkRoomTextMessage("Visit https://matrix.to/#/#room:example.com");
            const { container } = getComponent({ mxEvent: ev });
            const content = container.querySelector(".mx_EventTile_body");
            expect(content.innerHTML).toMatchInlineSnapshot(
                `"Visit <span><bdi><a class="mx_Pill mx_RoomPill" href="https://matrix.to/#/#room:example.com" aria-describedby="mx_Pill_0.123456"><div class="mx_Pill_LinkIcon mx_BaseAvatar mx_BaseAvatar_image"></div><span class="mx_Pill_text">#room:example.com</span></a></bdi></span>"`,
            );
        });

        it("should pillify a permalink to a message in the same room with the label »Message from Member«", () => {
            const ev = mkRoomTextMessage(`Visit https://matrix.to/#/${room1Id}/${defaultEvent.getId()}`);
            const { container } = getComponent({ mxEvent: ev });
            const content = container.querySelector(".mx_EventTile_body");
            expect(
                prettier.format(content.innerHTML.replace(defaultEvent.getId(), "%event_id%"), {
                    parser: "html",
                }),
            ).toMatchSnapshot();
        });

        it("should pillify a permalink to an unknown message in the same room with the label »Message«", () => {
            const ev = mkRoomTextMessage(`Visit https://matrix.to/#/${room1Id}/!abc123`);
            const { container } = getComponent({ mxEvent: ev });
            const content = container.querySelector(".mx_EventTile_body");
            expect(content).toMatchSnapshot();
        });

        it("should pillify a permalink to an event in another room with the label »Message in Room 2«", () => {
            const ev = mkRoomTextMessage(`Visit https://matrix.to/#/${room2Id}/${defaultEvent.getId()}`);
            const { container } = getComponent({ mxEvent: ev });
            const content = container.querySelector(".mx_EventTile_body");
            expect(
                prettier.format(content.innerHTML.replace(defaultEvent.getId(), "%event_id%"), {
                    parser: "html",
                }),
            ).toMatchSnapshot();
        });
    });

    describe("renders formatted m.text correctly", () => {
        let matrixClient: MatrixClient;
        beforeEach(() => {
            matrixClient = getMockClientWithEventEmitter({
                getRoom: () => mkStubRoom(room1Id, "room name", undefined),
                getAccountData: (): MatrixEvent | undefined => undefined,
                getUserId: () => "@me:my_server",
                getHomeserverUrl: () => "https://my_server/",
                on: (): void => undefined,
                removeListener: (): void => undefined,
                isGuest: () => false,
                mxcUrlToHttp: (s: string) => s,
            });
            DMRoomMap.makeShared(defaultMatrixClient);
        });

        it("italics, bold, underline and strikethrough render as expected", () => {
            const ev = mkFormattedMessage(
                "foo *baz* __bar__ <del>del</del> <u>u</u>",
                "foo <em>baz</em> <strong>bar</strong> <del>del</del> <u>u</u>",
            );
            const { container } = getComponent({ mxEvent: ev }, matrixClient);
            expect(container).toHaveTextContent("foo baz bar del u");
            const content = container.querySelector(".mx_EventTile_body");
            expect(content).toContainHTML(
                '<span class="mx_EventTile_body markdown-body" dir="auto">' +
                    ev.getContent().formatted_body +
                    "</span>",
            );
        });

        it("spoilers get injected properly into the DOM", () => {
            const ev = mkFormattedMessage(
                "Hey [Spoiler for movie](mxc://someserver/somefile)",
                'Hey <span data-mx-spoiler="movie">the movie was awesome</span>',
            );
            const { container } = getComponent({ mxEvent: ev }, matrixClient);
            expect(container).toHaveTextContent("Hey (movie) the movie was awesome");
            const content = container.querySelector(".mx_EventTile_body");
            expect(content).toContainHTML(
                '<span class="mx_EventTile_body markdown-body" dir="auto">' +
                    "Hey <span>" +
                    '<span class="mx_EventTile_spoiler">' +
                    '<span class="mx_EventTile_spoiler_reason">(movie)</span>&nbsp;' +
                    '<span class="mx_EventTile_spoiler_content"><span>the movie was awesome</span></span>' +
                    "</span></span></span>",
            );
        });

        it("linkification is not applied to code blocks", () => {
            const ev = mkFormattedMessage(
                "Visit `https://matrix.org/`\n```\nhttps://matrix.org/\n```",
                "<p>Visit <code>https://matrix.org/</code></p>\n<pre>https://matrix.org/\n</pre>\n",
            );
            const { container } = getComponent({ mxEvent: ev }, matrixClient);
            expect(container).toHaveTextContent("Visit https://matrix.org/ 1https://matrix.org/");
            const content = container.querySelector(".mx_EventTile_body");
            expect(content).toMatchSnapshot();
        });

        // If pills were rendered within a Portal/same shadow DOM then it'd be easier to test
        it("pills get injected correctly into the DOM", () => {
            const ev = mkFormattedMessage("Hey User", 'Hey <a href="https://matrix.to/#/@user:server">Member</a>');
            const { container } = getComponent({ mxEvent: ev }, matrixClient);
            expect(container).toHaveTextContent("Hey Member");
            const content = container.querySelector(".mx_EventTile_body");
            expect(content).toMatchSnapshot();
        });

        it("pills do not appear in code blocks", () => {
            const ev = mkFormattedMessage(
                "`@room`\n```\n@room\n```",
                "<p><code>@room</code></p>\n<pre><code>@room\n</code></pre>\n",
            );
            const { container } = getComponent({ mxEvent: ev });
            expect(container).toHaveTextContent("@room 1@room");
            const content = container.querySelector(".mx_EventTile_body");
            expect(content).toMatchSnapshot();
        });

        it("pills do not appear for event permalinks with a custom label", () => {
            const ev = mkFormattedMessage(
                "An [event link](https://matrix.to/#/!ZxbRYPQXDXKGmDnJNg:example.com/" +
                    "$16085560162aNpaH:example.com?via=example.com) with text",
                'An <a href="https://matrix.to/#/!ZxbRYPQXDXKGmDnJNg:example.com/' +
                    '$16085560162aNpaH:example.com?via=example.com">event link</a> with text',
            );
            const { asFragment, container } = getComponent({ mxEvent: ev }, matrixClient);
            expect(container).toHaveTextContent("An event link with text");
            expect(asFragment()).toMatchSnapshot();
        });

        it("pills appear for event permalinks without a custom label", () => {
            const ev = mkFormattedMessage(
                "See this message https://matrix.to/#/!ZxbRYPQXDXKGmDnJNg:example.com/$16085560162aNpaH:example.com?via=example.com",
                'See this message <a href="https://matrix.to/#/!ZxbRYPQXDXKGmDnJNg:example.com/$16085560162aNpaH:example.com?via=example.com">' +
                    "https://matrix.to/#/!ZxbRYPQXDXKGmDnJNg:example.com/$16085560162aNpaH:example.com?via=example.com</a>",
            );
            const { asFragment } = getComponent({ mxEvent: ev }, matrixClient);
            expect(asFragment()).toMatchSnapshot();
        });

        it("pills appear for room links with vias", () => {
            const ev = mkFormattedMessage(
                "A [room link](https://matrix.to/#/!ZxbRYPQXDXKGmDnJNg:example.com" +
                    "?via=example.com&via=bob.com) with vias",
                'A <a href="https://matrix.to/#/!ZxbRYPQXDXKGmDnJNg:example.com' +
                    '?via=example.com&amp;via=bob.com">room link</a> with vias',
            );
            const { asFragment, container } = getComponent({ mxEvent: ev }, matrixClient);
            expect(container).toHaveTextContent("A room name with vias");
            expect(asFragment()).toMatchSnapshot();
        });

        it("pills appear for an MXID permalink", () => {
            const ev = mkFormattedMessage(
                "Chat with [@user:example.com](https://matrix.to/#/@user:example.com)",
                'Chat with <a href="https://matrix.to/#/@user:example.com">@user:example.com</a>',
            );
            const { container } = getComponent({ mxEvent: ev }, matrixClient);
            const content = container.querySelector(".mx_EventTile_body");
            expect(content).toMatchSnapshot();
        });

        it("renders formatted body without html corretly", () => {
            const ev = mkEvent({
                type: "m.room.message",
                room: "room_id",
                user: "sender",
                content: {
                    body: "escaped \\*markdown\\*",
                    msgtype: "m.text",
                    format: "org.matrix.custom.html",
                    formatted_body: "escaped *markdown*",
                },
                event: true,
            });

            const { container } = getComponent({ mxEvent: ev }, matrixClient);

            const content = container.querySelector(".mx_EventTile_body");
            expect(content).toContainHTML(
                '<span class="mx_EventTile_body" dir="auto">' + "escaped *markdown*" + "</span>",
            );
        });
    });

    it("renders url previews correctly", () => {
        languageHandler.setMissingEntryGenerator((key) => key.split("|", 2)[1]);

        const matrixClient = getMockClientWithEventEmitter({
            getRoom: () => mkStubRoom("room_id", "room name", undefined),
            getAccountData: (): MatrixClient | undefined => undefined,
            getUrlPreview: (url: string) => new Promise(() => {}),
            isGuest: () => false,
            mxcUrlToHttp: (s: string) => s,
        });
        DMRoomMap.makeShared(defaultMatrixClient);

        const ev = mkRoomTextMessage("Visit https://matrix.org/");
        const { container, rerender } = getComponent(
            { mxEvent: ev, showUrlPreview: true, onHeightChanged: jest.fn() },
            matrixClient,
        );

        expect(container).toHaveTextContent(ev.getContent().body);
        expect(container.querySelector("a")).toHaveAttribute("href", "https://matrix.org/");

        // simulate an event edit and check the transition from the old URL preview to the new one
        const ev2 = mkEvent({
            type: "m.room.message",
            room: "room_id",
            user: "sender",
            content: {
                "m.new_content": {
                    body: "Visit https://vector.im/ and https://riot.im/",
                    msgtype: "m.text",
                },
            },
            event: true,
        });
        jest.spyOn(ev, "replacingEventDate").mockReturnValue(new Date(1993, 7, 3));
        ev.makeReplaced(ev2);

        getComponent(
            { mxEvent: ev, showUrlPreview: true, onHeightChanged: jest.fn(), replacingEventId: ev.getId() },
            matrixClient,
            rerender,
        );

        expect(container).toHaveTextContent(ev2.getContent()["m.new_content"].body + "(edited)");

        const links = ["https://vector.im/", "https://riot.im/"];
        const anchorNodes = container.querySelectorAll("a");
        Array.from(anchorNodes).forEach((node, index) => {
            expect(node).toHaveAttribute("href", links[index]);
        });
    });
});
