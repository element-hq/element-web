/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DiscoveryPanel } from "./DiscoveryPanel.tsx";
import { ImagePacksSettings } from "./ImagePacksSettings.tsx";
import { PackListPanel } from "./PackListPanel.tsx";
import type { UseImagePacksResult } from "./useImagePacks.ts";
import type { DiscoverySource, EmoteDefinition, ImagePackView } from "./types.ts";

afterEach(cleanup);

const emote: EmoteDefinition = { shortcode: "wave", url: "mxc://example.org/wave", body: "Wave" };

const personalPack: ImagePackView = {
    roomId: "@alice:example.org",
    stateKey: "im.ponies.user_emotes",
    scope: "user",
    kind: "personal",
    displayName: "Personal",
    pack: { displayName: "Personal", images: { wave: emote } },
};

const globalPack: ImagePackView = {
    roomId: "!packs:example.org",
    stateKey: "global",
    scope: "user",
    kind: "global",
    displayName: "Global",
    pack: { displayName: "Global", images: {} },
};

const roomPack: ImagePackView = {
    roomId: "!room:example.org",
    stateKey: "room",
    scope: "room",
    kind: "room",
    eventId: "$event",
    displayName: "Room",
    pack: { displayName: "Room", images: {} },
};

const roomWithoutEventId: ImagePackView = {
    ...roomPack,
    stateKey: "room-without-event",
    eventId: undefined,
    displayName: "Room without event",
};

const spacePack: ImagePackView = {
    roomId: "!space:example.org",
    stateKey: "space",
    scope: "space",
    kind: "space",
    displayName: "Space",
    pack: { displayName: "Space", images: {} },
};

const source: DiscoverySource = {
    id: "official",
    url: "https://packs.example.org/index.json",
    displayName: "Official packs",
};

function makeApi(overrides: Partial<UseImagePacksResult> = {}): UseImagePacksResult {
    return {
        packs: [],
        sources: [],
        loading: false,
        error: null,
        newEmote: { shortcode: "", url: "" },
        newPack: { roomId: "!room:example.org", stateKey: "", displayName: "", images: {} },
        newSource: { id: "", url: "" },
        setNewEmote: vi.fn(),
        setNewPack: vi.fn(),
        setNewSource: vi.fn(),
        refresh: vi.fn().mockResolvedValue(undefined),
        createRoomPack: vi.fn().mockResolvedValue(undefined),
        renameRoomPack: vi.fn().mockResolvedValue(undefined),
        deleteRoomPack: vi.fn().mockResolvedValue(undefined),
        redactRoomPack: vi.fn().mockResolvedValue(undefined),
        enablePackGlobally: vi.fn().mockResolvedValue(undefined),
        disablePackGlobally: vi.fn().mockResolvedValue(undefined),
        reorderPacks: vi.fn().mockResolvedValue(undefined),
        addRoomEmote: vi.fn().mockResolvedValue(undefined),
        editRoomEmote: vi.fn().mockResolvedValue(undefined),
        removeRoomEmote: vi.fn().mockResolvedValue(undefined),
        addUserEmote: vi.fn().mockResolvedValue(undefined),
        createUserPack: vi.fn().mockResolvedValue(undefined),
        editUserEmote: vi.fn().mockResolvedValue(undefined),
        removeUserEmote: vi.fn().mockResolvedValue(undefined),
        setUserPack: vi.fn().mockResolvedValue(undefined),
        deleteUserPack: vi.fn().mockResolvedValue(undefined),
        importPack: vi.fn().mockResolvedValue(undefined),
        addSource: vi.fn().mockResolvedValue([]),
        removeSource: vi.fn().mockResolvedValue([]),
        exportPack: vi.fn().mockReturnValue('{"images":{}}'),
        ...overrides,
    };
}

describe("ImagePacksSettings", () => {
    it("renders user, room, and discovery sections", () => {
        const api = makeApi({ packs: [personalPack, globalPack, roomPack], sources: [source] });

        render(<ImagePacksSettings api={api} roomId="!room:example.org" />);

        expect(screen.getByTestId("image-packs-tab")).toBeTruthy();
        expect(screen.queryByText("Make every message yours")).toBeNull();
        expect(screen.getByText("Personal & global packs")).toBeTruthy();
        expect(screen.getByText("Room packs")).toBeTruthy();
        expect(screen.getByText("Image-pack discovery sources")).toBeTruthy();
        expect(screen.getByTestId("pack-personal")).toBeTruthy();
        expect(screen.getByTestId("pack-!room:example.org-room")).toBeTruthy();
        expect(screen.getByTestId("source-official")).toBeTruthy();
    });

    it("honours section visibility options", () => {
        const api = makeApi({ packs: [personalPack], sources: [source] });

        render(<ImagePacksSettings api={api} roomId="!room:example.org" hideUserSection hideDiscovery />);

        expect(screen.queryByText("Personal & global packs")).toBeNull();
        expect(screen.getByText("Room packs")).toBeTruthy();
        expect(screen.queryByTestId("image-packs-discovery")).toBeNull();
    });
});

describe("PackListPanel", () => {
    it("uploads an image before adding an emote", async () => {
        const user = userEvent.setup();
        const file = new File(["image"], "wave.png", { type: "image/png" });
        const uploadImage = vi.fn().mockResolvedValue("mxc://example.org/uploaded");
        const api = makeApi({ packs: [personalPack], uploadImage });

        render(<PackListPanel api={api} onlyUserScope />);

        const personal = screen.getByTestId("pack-personal");
        await user.type(within(personal).getByRole("textbox", { name: "Shortcode" }), "uploaded_wave");
        await user.upload(within(personal).getByLabelText("Upload image"), file);
        await user.click(within(personal).getByRole("button", { name: "Add emote" }));

        expect(uploadImage).toHaveBeenCalledWith(file);
        expect(api.addUserEmote).toHaveBeenCalledWith({
            shortcode: "uploaded_wave",
            url: "mxc://example.org/uploaded",
        });
    });

    it("renders resolved media thumbnails and falls back when one cannot load", () => {
        const api = makeApi({
            packs: [personalPack],
            getImageUrl: (url, width, height) =>
                `https://media.example/${encodeURIComponent(url)}?w=${width}&h=${height}`,
        });

        render(<PackListPanel api={api} onlyUserScope />);

        const images = screen.getByTestId("pack-personal").querySelectorAll("img");
        expect(images).toHaveLength(2);
        expect(images[0]?.getAttribute("src")).toBe(`https://media.example/${encodeURIComponent(emote.url)}?w=40&h=40`);
        expect(images[1]?.getAttribute("src")).toBe(`https://media.example/${encodeURIComponent(emote.url)}?w=40&h=40`);
        fireEvent.error(images[0]!);
        expect(screen.getByTestId("pack-personal").querySelectorAll("img")).toHaveLength(1);
        expect(screen.getByTestId("pack-personal").textContent).toContain("WA");
    });

    it("renders errors and an empty state", () => {
        const api = makeApi({ error: "Something failed" });
        render(<PackListPanel api={api} />);
        expect(screen.getByRole("alert").textContent).toContain("Something failed");
        expect(screen.getByText("No image packs yet.")).toBeTruthy();
    });

    it("filters packs and handles pack, emote, and export actions", async () => {
        const user = userEvent.setup();
        const api = makeApi({ packs: [personalPack, globalPack, roomPack, roomWithoutEventId, spacePack] });
        vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:pack");
        vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

        render(<PackListPanel api={api} onlyUserScope showGlobalToggle />);
        expect(screen.getByTestId("pack-personal")).toBeTruthy();
        expect(screen.getByTestId("pack-!packs:example.org-global")).toBeTruthy();
        expect(screen.queryByTestId("pack-!room:example.org-room")).toBeNull();

        const personal = screen.getByTestId("pack-personal");
        await user.click(within(personal).getByRole("button", { name: "Add emote" }));
        expect(within(personal).getByText(/Shortcode must be/)).toBeTruthy();
        await user.type(within(personal).getByRole("textbox", { name: "Shortcode" }), "new_wave");
        await user.type(within(personal).getByRole("textbox", { name: "Image URL" }), "mxc://example.org/new");
        await user.click(within(personal).getByRole("button", { name: "Add emote" }));
        expect(api.addUserEmote).toHaveBeenCalledWith({
            shortcode: "new_wave",
            url: "mxc://example.org/new",
        });

        await user.click(within(personal).getByRole("button", { name: "Edit" }));
        const bodyInput = within(personal).getByRole("textbox", { name: "Body for wave" });
        await user.clear(bodyInput);
        await user.type(bodyInput, "Updated");
        await user.click(within(personal).getByRole("button", { name: "Save" }));
        expect(api.editUserEmote).toHaveBeenCalledWith({ ...emote, body: "Updated" });
        await user.click(within(personal).getByRole("button", { name: "Remove" }));
        expect(api.removeUserEmote).toHaveBeenCalledWith("wave");

        await user.click(within(personal).getByRole("button", { name: "Rename" }));
        const nameInput = within(personal).getByRole("textbox", { name: "Pack name" });
        await user.clear(nameInput);
        await user.type(nameInput, "Renamed");
        await user.click(within(personal).getByRole("button", { name: "Save" }));
        expect(api.setUserPack).toHaveBeenCalledWith({ ...personalPack.pack, displayName: "Renamed" });

        await user.click(within(personal).getByRole("button", { name: "Export" }));
        expect(api.exportPack).toHaveBeenCalledWith(personalPack.pack);
        await user.click(within(personal).getByRole("button", { name: "Delete" }));
        expect(api.deleteUserPack).toHaveBeenCalledOnce();

        const global = screen.getByTestId("pack-!packs:example.org-global");
        await user.click(within(global).getByRole("button", { name: "Disable globally" }));
        expect(api.disablePackGlobally).toHaveBeenCalledWith("!packs:example.org", "global");
    });

    it("keeps large packs scannable and searchable", async () => {
        const user = userEvent.setup();
        const images = Object.fromEntries(
            Array.from({ length: 25 }, (_, index) => [
                `emote_${index}`,
                { shortcode: `emote_${index}`, url: `mxc://example.org/emote-${index}` },
            ]),
        );
        const api = makeApi({
            packs: [{ ...personalPack, pack: { ...personalPack.pack, images } }],
        });

        render(<PackListPanel api={api} onlyUserScope />);

        expect(screen.getAllByTestId(/^emote-/)).toHaveLength(24);
        await user.click(screen.getByRole("button", { name: "Show all 25 emotes" }));
        expect(screen.getAllByTestId(/^emote-/)).toHaveLength(25);

        const search = screen.getByLabelText("Find a pack");
        await user.type(search, "does-not-exist");
        expect(screen.getByText("No packs match that search")).toBeTruthy();
        await user.clear(search);
        await user.type(search, "emote_24");
        expect(screen.getByTestId("pack-personal")).toBeTruthy();
    });

    it("handles room actions, emote validation, and creation forms", async () => {
        const user = userEvent.setup();
        const api = makeApi({ packs: [roomPack, roomWithoutEventId, spacePack] });

        render(
            <PackListPanel
                api={api}
                hideUserScope
                allowCreateRoomPack
                restrictToRoomId="!room:example.org"
                showGlobalToggle
            />,
        );

        const room = screen.getByTestId("pack-!room:example.org-room");
        await user.click(within(room).getByRole("button", { name: "Rename" }));
        await user.click(within(room).getByRole("button", { name: "Cancel" }));
        await user.click(within(room).getByRole("button", { name: "Delete" }));
        expect(api.redactRoomPack).toHaveBeenCalledWith("!room:example.org", "$event");

        const roomWithoutEvent = screen.getByTestId("pack-!room:example.org-room-without-event");
        await user.click(within(roomWithoutEvent).getByRole("button", { name: "Delete" }));
        expect(api.deleteRoomPack).toHaveBeenCalledWith("!room:example.org", "room-without-event");

        const emoteForm = room.querySelector<HTMLElement>(".mx_ImagePacksPanel_emoteForm")!;
        await user.type(within(emoteForm).getByRole("textbox", { name: "Shortcode" }), "bad value");
        await user.type(within(emoteForm).getByRole("textbox", { name: "Image URL" }), "https://example.org/image");
        await user.click(within(emoteForm).getByRole("button", { name: "Add emote" }));
        expect(within(room).getByText(/Shortcode must be/)).toBeTruthy();

        const newPack = screen.getByTestId("new-pack-form");
        await user.click(within(newPack).getByRole("button", { name: "Create pack" }));
        await user.type(within(newPack).getByRole("textbox", { name: "State key" }), "_order");
        await user.type(within(newPack).getByRole("textbox", { name: "Display name" }), "Invalid");
        await user.click(within(newPack).getByRole("button", { name: "Create pack" }));
        expect(api.createRoomPack).not.toHaveBeenCalled();
        await user.clear(within(newPack).getByRole("textbox", { name: "State key" }));
        await user.type(within(newPack).getByRole("textbox", { name: "State key" }), "new-pack");
        await user.click(within(newPack).getByRole("button", { name: "Create pack" }));
        expect(api.createRoomPack).toHaveBeenCalledWith({
            roomId: "!room:example.org",
            stateKey: "new-pack",
            displayName: "Invalid",
            usage: ["emoticon"],
            images: {},
        });
    });

    it("creates a personal pack and filters user rows", async () => {
        const user = userEvent.setup();
        const api = makeApi({ packs: [globalPack, roomPack] });
        render(<PackListPanel api={api} onlyUserScope allowCreateUserPack />);

        expect(screen.queryByTestId("pack-!room:example.org-room")).toBeNull();
        const newUserPack = screen.getByTestId("new-user-pack-form");
        await user.click(within(newUserPack).getByRole("button", { name: "Create pack" }));
        await user.type(within(newUserPack).getByRole("textbox", { name: "Personal pack display name" }), "Personal 2");
        await user.click(within(newUserPack).getByRole("button", { name: "Create pack" }));
        expect(api.createUserPack).toHaveBeenCalledWith({ displayName: "Personal 2", usage: ["emoticon"], images: {} });
    });

    it("does not offer a second personal pack that would replace the existing one", () => {
        const api = makeApi({ packs: [personalPack] });
        render(<PackListPanel api={api} onlyUserScope allowCreateUserPack />);

        expect(screen.getByTestId("pack-personal")).toBeTruthy();
        expect(screen.queryByTestId("new-user-pack-form")).toBeNull();
    });
});

describe("DiscoveryPanel", () => {
    it("adds, browses, installs, removes, and closes discovery sources", async () => {
        const user = userEvent.setup();
        const api = makeApi({ sources: [source] });
        const fetcher = {
            fetchJson: vi.fn(async (url: string): Promise<unknown> =>
                url.endsWith("index.json")
                    ? {
                          packs: [
                              {
                                  id: "waves",
                                  url: "https://packs.example.org/waves.json",
                                  display_name: "Waves",
                                  attribution: "Example",
                              },
                          ],
                      }
                    : { images: { wave: { url: "mxc://example.org/wave" } } },
            ),
        };

        render(<DiscoveryPanel api={api} fetcher={fetcher} installRoomId="!room:example.org" />);
        await user.click(within(screen.getByTestId("source-official")).getByRole("button", { name: "Browse" }));
        expect(await screen.findByTestId("discovery-browse")).toBeTruthy();
        await user.click(screen.getByRole("button", { name: "Install" }));
        expect(api.importPack).toHaveBeenCalledWith(
            {
                images: { wave: { url: "mxc://example.org/wave" } },
                pack: { display_name: "Waves", attribution: "Example" },
            },
            "!room:example.org",
            "waves",
            "Waves",
        );
        await user.click(screen.getByRole("button", { name: "Close" }));
        expect(screen.queryByTestId("discovery-browse")).toBeNull();

        await user.click(within(screen.getByTestId("source-official")).getByRole("button", { name: "Remove" }));
        expect(api.removeSource).toHaveBeenCalledWith("official");

        const newSource = screen.getByTestId("new-source-form");
        await user.click(within(newSource).getByRole("button", { name: "Add source" }));
        await user.type(within(newSource).getByRole("textbox", { name: "Source ID" }), "community");
        await user.type(
            within(newSource).getByRole("textbox", { name: "Source URL" }),
            "https://packs.example.org/community.json",
        );
        await user.click(within(newSource).getByRole("button", { name: "Add source" }));
        expect(api.addSource).toHaveBeenCalledWith({
            id: "community",
            url: "https://packs.example.org/community.json",
        });
    });

    it("shows browse and install errors", async () => {
        const user = userEvent.setup();
        const api = makeApi({ sources: [source] });
        const fetcher = { fetchJson: vi.fn().mockRejectedValue(new Error("network failed")) };
        render(<DiscoveryPanel api={api} fetcher={fetcher} installRoomId="!room:example.org" />);

        await user.click(screen.getByRole("button", { name: "Browse" }));
        expect((await screen.findByRole("alert")).textContent).toContain("network failed");

        fetcher.fetchJson.mockResolvedValueOnce({
            packs: [{ id: "bad", url: "https://packs.example.org/bad.json" }],
        });
        await user.click(screen.getByRole("button", { name: "Browse" }));
        expect(await screen.findByTestId("discovery-entry-bad")).toBeTruthy();
        fetcher.fetchJson.mockRejectedValueOnce(new Error("pack failed"));
        await user.click(screen.getByRole("button", { name: "Install" }));
        expect(await screen.findByText("pack failed")).toBeTruthy();
    });
});
