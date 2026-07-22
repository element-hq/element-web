/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkStubRoom, stubClient } from "test-utils";

import CustomEmoteProvider from "./CustomEmoteProvider";
import { getCustomEmotesForRoom, type CustomEmote, type ResolvedImagePack } from "../custom-emotes";

vi.mock("../custom-emotes", () => ({
    getCustomEmotesForRoom: vi.fn(),
}));

const room = mkStubRoom("!room:example.org", "Room");
const roomPack: ResolvedImagePack = {
    roomId: room.roomId,
    stateKey: "room-pack",
    displayName: "Room Pack",
    source: "room",
    content: { images: {} },
};
const globalPack: ResolvedImagePack = {
    roomId: "!global:example.org",
    stateKey: "global-pack",
    displayName: "Global Pack",
    source: "global",
    content: { images: {} },
};

function emote(shortcode: string, pack: ResolvedImagePack, sendToken = `:${shortcode}:`): CustomEmote {
    return {
        shortcode,
        url: `mxc://example.org/${shortcode}`,
        body: `${shortcode} description`,
        pack,
        packSlug: pack.displayName.toLowerCase().replace(" ", "-"),
        sendToken,
    };
}

describe("CustomEmoteProvider", () => {
    beforeEach(() => {
        stubClient();
        vi.mocked(getCustomEmotesForRoom).mockReset();
    });

    it("orders exact, prefix, and substring matches", async () => {
        vi.mocked(getCustomEmotesForRoom).mockReturnValue([
            emote("superparty", roomPack),
            emote("partyparrot", roomPack),
            emote("party", roomPack),
        ]);
        const provider = new CustomEmoteProvider(room);
        const completions = await provider.getCompletions(":party", { beginning: true, start: 0, end: 6 });

        expect(completions.map(({ completion }) => completion)).toEqual([":party:", ":partyparrot:", ":superparty:"]);
    });

    it("keeps source priority for duplicate shortcodes and inserts qualified tokens", async () => {
        vi.mocked(getCustomEmotesForRoom).mockReturnValue([
            emote("wave", globalPack, ":wave/global-pack:"),
            emote("wave", roomPack, ":wave/room-pack:"),
        ]);
        const provider = new CustomEmoteProvider(room);
        const completions = await provider.getCompletions(":WAVE:", { beginning: true, start: 0, end: 6 });

        expect(completions.map(({ completion }) => completion)).toEqual([":wave/global-pack:", ":wave/room-pack:"]);
        expect(completions[0].customEmote).toEqual({
            shortcode: "wave",
            url: "mxc://example.org/wave",
            body: "wave description",
        });
    });

    it("does not replace Unicode emoji completions", async () => {
        vi.mocked(getCustomEmotesForRoom).mockReturnValue([emote("party", roomPack)]);
        const provider = new CustomEmoteProvider(room);
        const completions = await provider.getCompletions("🎉", { beginning: true, start: 0, end: 2 });
        expect(completions).toEqual([]);
    });
});
