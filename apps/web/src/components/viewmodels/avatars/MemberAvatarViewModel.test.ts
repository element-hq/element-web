/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { it, describe, expect, vi } from "vitest";
import { RoomStateEvent } from "matrix-js-sdk/src/matrix";

import { mkRoom, mkRoomMember, stubClient } from "../../../../test/test-utils";
import { MemberAvatarViewModel } from "./MemberAvatarViewModel";

vi.mock(import("../../../customisations/Media"), () => {
    return {
        mediaFromMxc: vi.fn().mockReturnValue({
            getThumbnailOfSourceHttp: () => "avatar-url",
        }),
    };
});

describe("MemberAvatarViewModel", () => {
    it("should compute the correct initial snapshot", () => {
        const cli = stubClient();
        const member = mkRoomMember("!my-room:m.org", "@alice:m.org");
        member.getMxcAvatarUrl = () => "avatar-mxc-url";
        member.name = "Alice";
        const vm = new MemberAvatarViewModel({ cli, member, size: "20" });
        const snapshot = vm.getSnapshot();
        expect(snapshot.id).toStrictEqual("@alice:m.org");
        expect(snapshot.title).toStrictEqual("@alice:m.org");
        expect(snapshot.name).toStrictEqual("Alice");
        expect(snapshot.size).toStrictEqual("20px");
        expect(snapshot.url).toStrictEqual("avatar-url");
    });

    it("should update state", () => {
        const cli = stubClient();
        const room = mkRoom(cli, "!my-room:m.org");
        cli.getRoom = () => room;
        const member = mkRoomMember("!my-room:m.org", "@alice:m.org");
        member.name = "Alice";

        // The name is initially Alice
        const vm = new MemberAvatarViewModel({ cli, member, size: "20" });
        expect(vm.getSnapshot().name).toStrictEqual("Alice");

        // On room event, name should update to Bob
        member.name = "Bob";
        // @ts-ignore
        room.emit(RoomStateEvent.Members, undefined, undefined, member);
        expect(vm.getSnapshot().name).toStrictEqual("Bob");
    });
});
