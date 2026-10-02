/*
Copyright 2026 Wang Hung Ju

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "test-utils-rtl";
import { EventType, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { stubClient } from "test-utils";

import { useIsEncrypted } from "./useIsEncrypted";

describe("useIsEncrypted", () => {
    const roomId = "!room:server";

    function setEncrypted(room: Room): void {
        room.currentState.setStateEvents([
            new MatrixEvent({
                type: EventType.RoomEncryption,
                state_key: "",
                content: { algorithm: "m.megolm.v1.aes-sha2" },
                sender: "@alice:server",
                room_id: roomId,
            }),
        ]);
    }

    it("returns null when there is no room", () => {
        const client = stubClient();
        const { result } = renderHook(() => useIsEncrypted(client, undefined));
        expect(result.current).toBeNull();
    });

    it("reports encrypted immediately, before the async crypto check resolves", async () => {
        const client = stubClient();
        const room = new Room(roomId, client, client.getSafeUserId());
        setEncrypted(room);

        // Never resolves during this test, to prove the initial render doesn't wait for it.
        vi.spyOn(client.getCrypto()!, "isEncryptionEnabledInRoom").mockReturnValue(new Promise(() => {}));

        const { result } = renderHook(() => useIsEncrypted(client, room));

        expect(result.current).toBe(true);
    });

    it("resolves to false for an unencrypted room", async () => {
        const client = stubClient();
        const room = new Room(roomId, client, client.getSafeUserId());
        vi.spyOn(client.getCrypto()!, "isEncryptionEnabledInRoom").mockResolvedValue(false);

        const { result } = renderHook(() => useIsEncrypted(client, room));

        expect(result.current).toBe(false);
        await waitFor(() => expect(result.current).toBe(false));
    });
});
