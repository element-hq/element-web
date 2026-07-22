/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "test-utils-rtl";
import { describe, expect, it, vi } from "vitest";

import { type CustomEmote, type ResolvedImagePack } from "../../../custom-emotes";
import EmojiPicker from "./EmojiPicker";

vi.mock("../../../customisations/Media", () => ({
    mediaFromMxc: (url: string) => ({ getSquareThumbnailHttp: () => `https://example.org/${url.slice(6)}` }),
}));

vi.mock("../../../emojipicker/recent", () => ({
    add: vi.fn(),
    get: () => [],
}));

const neofoxPack: ResolvedImagePack = {
    roomId: "!neofox:example.org",
    stateKey: "neofox",
    displayName: "Neofox",
    source: "user",
    content: { images: {} },
};

const partyPack: ResolvedImagePack = {
    roomId: "!party:example.org",
    stateKey: "party",
    displayName: "Party pack",
    source: "space",
    content: { images: {} },
};

const customEmotes: CustomEmote[] = [
    {
        shortcode: "neofox_sad",
        url: "mxc://example.org/sad",
        body: "Sad neofox",
        pack: neofoxPack,
        packSlug: "neofox",
        sendToken: ":neofox_sad:",
    },
    {
        shortcode: "party_blob",
        url: "mxc://example.org/party",
        body: "Party blob",
        pack: partyPack,
        packSlug: "party-pack",
        sendToken: ":party_blob:",
    },
];

describe("EmojiPicker custom emotes", () => {
    it("groups, searches, previews, and chooses custom emotes", async () => {
        const user = userEvent.setup();
        const onChooseCustomEmote = vi.fn(() => true);
        render(
            <EmojiPicker
                customEmotes={customEmotes}
                onChooseCustomEmote={onChooseCustomEmote}
                onChoose={() => true}
                onFinished={vi.fn()}
            />,
        );

        expect(screen.getByRole("tab", { name: "Custom emotes" })).toBeEnabled();
        expect(screen.getByRole("grid", { name: "Neofox" })).toBeInTheDocument();
        expect(screen.getByRole("grid", { name: "Party pack" })).toBeInTheDocument();

        const sadEmote = screen.getByRole("button", { name: ":neofox_sad: — Neofox" });
        await user.hover(sadEmote);
        expect(screen.getByText("Sad neofox")).toBeInTheDocument();

        await user.click(sadEmote);
        expect(onChooseCustomEmote).toHaveBeenCalledWith(customEmotes[0]);

        await user.type(screen.getByRole("textbox", { name: "Search" }), "party");
        expect(screen.queryByRole("button", { name: ":neofox_sad: — Neofox" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: ":party_blob: — Party pack" })).toBeInTheDocument();
    });
});
