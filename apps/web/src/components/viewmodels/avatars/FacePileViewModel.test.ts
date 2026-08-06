/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { it, describe, expect } from "vitest";

import { mkRoomMember, stubClient } from "../../../../test/test-utils";
import { FacePileViewModel } from "./FacePileViewModel";

describe("FacePileViewModel", () => {
    it("should compute the correct initial state", () => {
        const cli = stubClient();
        const members = [
            mkRoomMember("!my-room:m.org", "@alice:m.org"),
            mkRoomMember("!my-room:m.org", "@bob:m.org"),
            mkRoomMember("!my-room:m.org", "@jack:m.org"),
        ];
        const vm = new FacePileViewModel({
            cli,
            members,
            size: 20,
        });
        expect(vm.getSnapshot().memberAvatarViewModels).toHaveLength(3);
    });

    it("should update on updateMembers()", () => {
        const cli = stubClient();
        const members = [mkRoomMember("!my-room:m.org", "@alice:m.org"), mkRoomMember("!my-room:m.org", "@bob:m.org")];
        const vm = new FacePileViewModel({
            cli,
            members,
            size: 20,
        });
        expect(vm.getSnapshot().memberAvatarViewModels).toHaveLength(2);

        vm.updateMembers([
            mkRoomMember("!my-room:m.org", "@alice:m.org"),
            mkRoomMember("!my-room:m.org", "@bob:m.org"),
            mkRoomMember("!my-room:m.org", "@jack:m.org"),
        ]);

        expect(vm.getSnapshot().memberAvatarViewModels).toHaveLength(3);
    });
});
