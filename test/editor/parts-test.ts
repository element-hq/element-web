/*
Copyright 2022 - 2023 The Matrix.org Foundation C.I.C.

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

import { MatrixClient, Room, RoomMember } from "matrix-js-sdk/src/matrix";

import { EmojiPart, PartCreator, PlainPart } from "../../src/editor/parts";
import DMRoomMap from "../../src/utils/DMRoomMap";
import { stubClient } from "../test-utils";
import { createPartCreator } from "./mock";

describe("editor/parts", () => {
    describe("appendUntilRejected", () => {
        const femaleFacepalmEmoji = "🤦‍♀️";

        it("should not accept emoji strings into type=plain", () => {
            const part = new PlainPart();
            expect(part.appendUntilRejected(femaleFacepalmEmoji, "")).toEqual(femaleFacepalmEmoji);
            expect(part.text).toEqual("");
        });

        it("should accept emoji strings into type=emoji", () => {
            const part = new EmojiPart();
            expect(part.appendUntilRejected(femaleFacepalmEmoji, "")).toBeUndefined();
            expect(part.text).toEqual(femaleFacepalmEmoji);
        });
    });

    it("should not explode on room pills for unknown rooms", () => {
        const pc = createPartCreator();
        const part = pc.roomPill("#room:server");
        expect(() => part.toDOMNode()).not.toThrow();
    });
});

describe("UserPillPart", () => {
    const roomId = "!room:example.com";
    let client: MatrixClient;
    let room: Room;
    let creator: PartCreator;

    beforeEach(() => {
        client = stubClient();
        room = new Room(roomId, client, "@me:example.com");
        creator = new PartCreator(room, client);
    });

    it("matches snapshot (no avatar)", () => {
        jest.spyOn(room, "getMember").mockReturnValue(new RoomMember(room.roomId, "@user:example.com"));
        const pill = creator.userPill("DisplayName", "@user:example.com");
        const el = pill.toDOMNode();

        expect(el).toMatchSnapshot();
    });

    it("matches snapshot (avatar)", () => {
        const member = new RoomMember(room.roomId, "@user:example.com");
        jest.spyOn(room, "getMember").mockReturnValue(member);
        jest.spyOn(member, "getMxcAvatarUrl").mockReturnValue("mxc://www.example.com/avatar.png");

        const pill = creator.userPill("DisplayName", "@user:example.com");
        const el = pill.toDOMNode();

        expect(el).toMatchSnapshot();
    });
});

describe("RoomPillPart", () => {
    const roomId = "!room:example.com";
    let client: jest.Mocked<MatrixClient>;
    let room: Room;
    let creator: PartCreator;

    beforeEach(() => {
        client = stubClient() as jest.Mocked<MatrixClient>;
        DMRoomMap.makeShared();

        room = new Room(roomId, client, "@me:example.com");
        client.getRoom.mockReturnValue(room);
        creator = new PartCreator(room, client);
    });

    it("matches snapshot (no avatar)", () => {
        jest.spyOn(room, "getMxcAvatarUrl").mockReturnValue(null);
        const pill = creator.roomPill("super-secret clubhouse");
        const el = pill.toDOMNode();

        expect(el).toMatchSnapshot();
    });

    it("matches snapshot (avatar)", () => {
        jest.spyOn(room, "getMxcAvatarUrl").mockReturnValue("mxc://www.example.com/avatars/room1.jpeg");
        const pill = creator.roomPill("cool chat club");
        const el = pill.toDOMNode();

        expect(el).toMatchSnapshot();
    });
});
