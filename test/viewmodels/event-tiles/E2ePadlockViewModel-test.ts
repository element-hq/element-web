/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mkEvent, stubClient } from "../../test-utils";
import { E2ePadlockViewModel } from "../../../src/viewmodels/event-tile/E2ePadlockViewModel";
import { isLocalRoom } from "../../../src/utils/localRoom/isLocalRoom";
import type { Mock } from "jest-mock";

jest.mock("../../../src/utils/localRoom/isLocalRoom");

describe("E2ePadlockViewModel", () => {
    it("should have initial state with noShield = true", () => {
        const event = mkEvent({
            type: "m.room.message",
            user: "foo@matrix.org",
            content: {
                body: "This is a message",
                msgtype: "m.text",
            },
        });
        const cli = stubClient();
        const isRoomEncrypted = true;
        const vm = new E2ePadlockViewModel({ event, cli, isRoomEncrypted });
        expect(vm.getSnapshot()).toStrictEqual({ noShield: true });
    });

    it("should have state with noShield = true for local room", async () => {
        (isLocalRoom as Mock).mockImplementation(() => true);
        const event = mkEvent({
            event: true,
            type: "m.room.message",
            user: "foo@matrix.org",
            content: {
                body: "This is a message",
                msgtype: "m.text",
            },
        });
        const cli = stubClient();
        const isRoomEncrypted = true;
        const vm = new E2ePadlockViewModel({ event, cli, isRoomEncrypted });
        await vm.verifyEvent();
        expect(vm.getSnapshot()).toStrictEqual({ noShield: true });
        jest.restoreAllMocks();
    });

    it("should not show padlock for events expected to be unencrypted", async () => {
        const event = mkEvent({
            event: true,
            type: "m.foo",
            user: "foo@matrix.org",
            content: {},
            skey: "foo",
        });
        const cli = stubClient();
        const isRoomEncrypted = true;
        const vm = new E2ePadlockViewModel({ event, cli, isRoomEncrypted });
        await vm.verifyEvent();
        expect(vm.getSnapshot()).toStrictEqual({ noShield: true });
    });
});
