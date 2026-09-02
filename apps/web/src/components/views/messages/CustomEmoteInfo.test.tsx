/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { ClientEvent, type MatrixClient, MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "test-utils-rtl";

import { getMockClientWithEventEmitter, mkStubRoom } from "test-utils";
import * as customEmotes from "../../../custom-emotes";
import { IMAGE_PACK_ROOMS_EVENT_TYPE, LEGACY_USER_IMAGE_PACK_EVENT_TYPE } from "../../../custom-emotes";
import * as MediaModule from "../../../customisations/Media";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { UserTab } from "../dialogs/UserTab";
import { CustomEmoteInfo, getRawCustomEmoteMxcs, resolveRawCustomEmoteMxc } from "./CustomEmoteInfo";

describe("CustomEmoteInfo", () => {
    const roomId = "!room:example.org";
    const mxcUrl = "mxc://example.org/wave";
    const srcHttp = "https://example.org/_matrix/client/v3/media/download/example.org/wave";
    let client: MatrixClient;
    let room: Room;
    let event: MatrixEvent;

    beforeEach(() => {
        client = getMockClientWithEventEmitter({
            getAccountData: vi.fn().mockReturnValue(undefined),
            getUserId: vi.fn().mockReturnValue("@alice:example.org"),
            getRoom: vi.fn(),
            setAccountData: vi.fn().mockResolvedValue(undefined),
        });
        room = mkStubRoom(roomId, "Room", client);
        event = new MatrixEvent({
            type: "m.room.message",
            room_id: roomId,
            sender: "@sender:example.org",
            content: {
                body: ":wave:",
                msgtype: "m.text",
                format: "org.matrix.custom.html",
                formatted_body: `<img data-mx-emoticon="" src="${mxcUrl}" alt="A friendly wave" title="wave">`,
            },
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("uses the replacement body when an edit changes an emote media URL", () => {
        const replacementMxcUrl = "mxc://example.org/replacement-wave";
        const editedEvent = new MatrixEvent({
            type: "m.room.message",
            room_id: roomId,
            sender: "@sender:example.org",
            content: {
                "body": ":wave:",
                "msgtype": "m.text",
                "format": "org.matrix.custom.html",
                "formatted_body": `<img data-mx-emoticon="" src="${mxcUrl}" title="wave">`,
                "m.new_content": {
                    body: ":wave:",
                    msgtype: "m.text",
                    format: "org.matrix.custom.html",
                    formatted_body: `<img data-mx-emoticon="" src="${replacementMxcUrl}" title="wave">`,
                },
            },
        });

        expect(getRawCustomEmoteMxcs(editedEvent, "wave")).toEqual([replacementMxcUrl]);
    });

    it("ignores malformed or missing raw emote media", () => {
        const malformedEvent = new MatrixEvent({
            type: "m.room.message",
            room_id: roomId,
            content: {
                formatted_body: `<img data-mx-emoticon="" src="https://example.org/wave" title="wave">`,
            },
        });

        expect(getRawCustomEmoteMxcs(malformedEvent, "wave")).toEqual([]);
        expect(getRawCustomEmoteMxcs(undefined, "wave")).toEqual([]);
    });

    it("lists every media URL when packs share a shortcode in one message", () => {
        const otherMxcUrl = "mxc://example.org/other-wave";
        const sharedEvent = new MatrixEvent({
            type: "m.room.message",
            room_id: roomId,
            content: {
                formatted_body:
                    `<img data-mx-emoticon="" src="${mxcUrl}" title="wave">` +
                    `<img data-mx-emoticon="" src="${otherMxcUrl}" title="wave">`,
            },
        });

        expect(getRawCustomEmoteMxcs(sharedEvent, "wave")).toEqual([mxcUrl, otherMxcUrl]);
        // A bare shortcode lookup stays ambiguous without the clicked image.
        expect(resolveRawCustomEmoteMxc(sharedEvent, "wave", undefined, () => null)).toBeUndefined();
    });

    it("attributes a shared shortcode to the clicked image source", () => {
        const otherMxcUrl = "mxc://example.org/other-wave";
        const otherSrcHttp = "https://example.org/_matrix/client/v3/media/download/example.org/other-wave";
        const sharedEvent = new MatrixEvent({
            type: "m.room.message",
            room_id: roomId,
            content: {
                formatted_body:
                    `<img data-mx-emoticon="" src="${mxcUrl}" title="wave">` +
                    `<img data-mx-emoticon="" src="${otherMxcUrl}" title="wave">`,
            },
        });
        const toHttpSrc = (mxc: string): string | null =>
            mxc === mxcUrl ? srcHttp : mxc === otherMxcUrl ? otherSrcHttp : null;

        expect(resolveRawCustomEmoteMxc(sharedEvent, "wave", otherSrcHttp, toHttpSrc)).toBe(otherMxcUrl);
        expect(resolveRawCustomEmoteMxc(sharedEvent, "wave", srcHttp, toHttpSrc)).toBe(mxcUrl);
        expect(resolveRawCustomEmoteMxc(sharedEvent, "wave", "https://example.org/unknown", toHttpSrc)).toBeUndefined();
        expect(resolveRawCustomEmoteMxc(sharedEvent, "wave", undefined, toHttpSrc)).toBeUndefined();
        expect(resolveRawCustomEmoteMxc(sharedEvent, "wave", otherSrcHttp, () => null)).toBeUndefined();
    });

    it("opens the pack of the clicked image when packs share a shortcode", () => {
        const otherMxcUrl = "mxc://example.org/other-wave";
        const otherSrcHttp = "https://example.org/_matrix/client/v3/media/download/example.org/other-wave";
        const sharedEvent = new MatrixEvent({
            type: "m.room.message",
            room_id: roomId,
            sender: "@sender:example.org",
            content: {
                body: ":wave: :wave:",
                msgtype: "m.text",
                format: "org.matrix.custom.html",
                formatted_body:
                    `<img data-mx-emoticon="" src="${mxcUrl}" alt="Wave A" title="wave">` +
                    `<img data-mx-emoticon="" src="${otherMxcUrl}" alt="Wave B" title="wave">`,
            },
        });
        const packA: customEmotes.ResolvedImagePack = {
            roomId,
            stateKey: "pack-a",
            displayName: "Pack A",
            source: "room",
            content: { images: { wave: { url: mxcUrl } } },
        };
        const packB: customEmotes.ResolvedImagePack = {
            roomId,
            stateKey: "pack-b",
            displayName: "Pack B",
            source: "room",
            content: { images: { wave: { url: otherMxcUrl } } },
        };
        vi.spyOn(customEmotes, "getCustomEmotesForRoom").mockReturnValue([
            { shortcode: "wave", url: mxcUrl, pack: packA, packSlug: "pack-a", sendToken: ":wave/pack-a:" },
            { shortcode: "wave", url: otherMxcUrl, pack: packB, packSlug: "pack-b", sendToken: ":wave/pack-b:" },
        ]);
        vi.spyOn(MediaModule, "mediaFromMxc").mockImplementation(
            (mxc?: string) =>
                ({ srcHttp: mxc === mxcUrl ? srcHttp : mxc === otherMxcUrl ? otherSrcHttp : null }) as never,
        );

        render(<CustomEmoteInfo mxEvent={sharedEvent} room={room} src={otherSrcHttp} title="wave" alt="Wave B" />);
        fireEvent.click(screen.getByRole("button", { name: ":wave:" }));

        expect(screen.getByText("Pack B")).toBeInTheDocument();
        expect(screen.queryByText("Pack A")).toBeNull();
        expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    });

    it("resolves packs only when the emote is opened and closes when the viewport moves", () => {
        const pack: customEmotes.ResolvedImagePack = {
            roomId,
            stateKey: "room-emotes",
            displayName: "Room emotes",
            source: "room",
            content: { images: { wave: { url: mxcUrl, body: "A friendly wave" } } },
        };
        const resolver = vi.spyOn(customEmotes, "getCustomEmotesForRoom").mockReturnValue([
            {
                shortcode: "wave",
                url: mxcUrl,
                body: "A friendly wave",
                pack,
                packSlug: "room-emotes",
                sendToken: ":wave:",
            },
        ]);

        render(<CustomEmoteInfo mxEvent={event} room={room} src={srcHttp} title="wave" alt="A friendly wave" />);

        expect(resolver).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: ":wave:" }));
        expect(resolver).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("dialog", { name: /custom emotes/i })).toHaveTextContent("Room emotes");
        expect(screen.getByRole("dialog").querySelector(".mx_CustomEmoteInfo_preview")).toHaveAttribute("src", srcHttp);

        fireEvent.click(screen.getByRole("button", { name: ":wave:" }));
        expect(screen.queryByRole("dialog")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: ":wave:" }));
        expect(resolver).toHaveBeenCalledTimes(2);

        fireEvent.scroll(window);
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("does not attribute a pack when the shortcode uses a different media URL", () => {
        const pack: customEmotes.ResolvedImagePack = {
            roomId,
            stateKey: "room-emotes",
            displayName: "Wrong pack",
            source: "room",
            content: { images: { wave: { url: "mxc://example.org/other-wave" } } },
        };
        vi.spyOn(customEmotes, "getCustomEmotesForRoom").mockReturnValue([
            {
                shortcode: "wave",
                url: "mxc://example.org/other-wave",
                pack,
                packSlug: "room-emotes",
                sendToken: ":wave:",
            },
        ]);
        render(<CustomEmoteInfo mxEvent={event} room={room} src={srcHttp} title="wave" alt="A friendly wave" />);

        fireEvent.click(screen.getByRole("button", { name: ":wave:" }));

        expect(screen.queryByText("Wrong pack")).toBeNull();
        expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("wave");
    });

    it.each([
        ["user", "Private"],
        ["global", "Public"],
        ["space", "Space"],
        ["room", "Room"],
    ] as const)("labels a %s pack correctly", (source, scope) => {
        const pack: customEmotes.ResolvedImagePack = {
            roomId,
            stateKey: `${source}-emotes`,
            displayName: `${scope} emotes`,
            source,
            content: {
                images: { wave: { url: mxcUrl, body: "A friendly wave" } },
                pack: { attribution: "Pack author", avatar_url: "mxc://example.org/avatar" },
            },
        };
        vi.spyOn(customEmotes, "getCustomEmotesForRoom").mockReturnValue([
            {
                shortcode: "wave",
                url: mxcUrl,
                body: "A friendly wave",
                pack,
                packSlug: `${source}-emotes`,
                sendToken: ":wave:",
            },
        ]);

        render(<CustomEmoteInfo mxEvent={event} room={room} src={srcHttp} title="wave" alt="A friendly wave" />);
        fireEvent.click(screen.getByRole("button", { name: ":wave:" }));

        expect(screen.getByText(scope, { selector: ".mx_CustomEmoteInfo_packScope" })).toBeInTheDocument();
        expect(screen.getByRole("dialog").querySelector(".mx_CustomEmoteInfo_attribution")).toHaveTextContent(
            "Pack author",
        );
        expect(
            screen.getByText(scope[0], { selector: ".mx_CustomEmoteInfo_packAvatarPlaceholder" }),
        ).toBeInTheDocument();
    });

    it("opens image-pack settings for an enabled pack", () => {
        const pack: customEmotes.ResolvedImagePack = {
            roomId,
            stateKey: "global-emotes",
            displayName: "Public emotes",
            source: "global",
            content: { images: { wave: { url: mxcUrl } } },
        };
        vi.spyOn(customEmotes, "getCustomEmotesForRoom").mockReturnValue([
            { shortcode: "wave", url: mxcUrl, pack, packSlug: "global-emotes", sendToken: ":wave:" },
        ]);
        vi.spyOn(dis, "dispatch").mockImplementation(() => undefined);

        render(<CustomEmoteInfo mxEvent={event} room={room} src={srcHttp} title="wave" alt="A friendly wave" />);
        fireEvent.click(screen.getByRole("button", { name: ":wave:" }));
        fireEvent.click(screen.getByRole("button", { name: /Open Custom emotes/ }));

        expect(dis.dispatch).toHaveBeenCalledWith({
            action: Action.ViewUserSettings,
            initialTabId: UserTab.ImagePacks,
        });
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("enables a room pack and reports a transient failure", async () => {
        const pack: customEmotes.ResolvedImagePack = {
            roomId,
            stateKey: "room-emotes",
            displayName: "Room emotes",
            source: "room",
            content: { images: { wave: { url: mxcUrl } } },
        };
        vi.spyOn(customEmotes, "getCustomEmotesForRoom").mockReturnValue([
            { shortcode: "wave", url: mxcUrl, pack, packSlug: "room-emotes", sendToken: ":wave:" },
        ]);
        const enable = vi.spyOn(customEmotes, "enableGlobalPack").mockResolvedValue(undefined);

        const view = render(
            <CustomEmoteInfo mxEvent={event} room={room} src={srcHttp} title="wave" alt="A friendly wave" />,
        );
        fireEvent.click(screen.getByRole("button", { name: ":wave:" }));
        fireEvent.click(screen.getByRole("button", { name: /Enable Custom emotes/ }));
        await waitFor(() => expect(enable).toHaveBeenCalledWith(client, { roomId, stateKey: "room-emotes" }));
        expect(screen.getByText("Saved")).toBeInTheDocument();

        view.unmount();
        enable.mockRejectedValueOnce(new Error("offline"));
        render(<CustomEmoteInfo mxEvent={event} room={room} src={srcHttp} title="wave" alt="A friendly wave" />);
        fireEvent.click(screen.getByRole("button", { name: ":wave:" }));
        fireEvent.click(screen.getByRole("button", { name: /Enable Custom emotes/ }));
        await waitFor(() => expect(screen.getByText("Could not save. Try again.")).toBeInTheDocument());
    });

    it("requires a valid, non-colliding shortcode before adding an unattributed emote", () => {
        vi.spyOn(customEmotes, "getCustomEmotesForRoom").mockReturnValue([]);
        render(<CustomEmoteInfo mxEvent={event} room={room} src={srcHttp} title="wave" alt="A friendly wave" />);

        fireEvent.click(screen.getByRole("button", { name: ":wave:" }));
        const input = screen.getByRole("textbox", { name: "Name" });
        const add = screen.getByRole("button", { name: /Add/ });
        expect(add).toBeEnabled();

        fireEvent.change(input, { target: { value: "wave/room" } });
        expect(input).toHaveAttribute("aria-invalid", "true");
        expect(add).toBeDisabled();
        expect(screen.getByText("Use letters, numbers, _ and -, up to 100 characters.")).toBeInTheDocument();

        const accountEvent = new MatrixEvent({
            type: LEGACY_USER_IMAGE_PACK_EVENT_TYPE,
            content: { images: { wave: { url: mxcUrl } } },
        });
        vi.mocked(client.getAccountData).mockReturnValue(accountEvent);
        fireEvent.change(input, { target: { value: "wave" } });
        expect(add).toBeDisabled();
        expect(screen.getByText("This name is already in your personal pack.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /remove wave/i })).toBeInTheDocument();
    });

    it("does not show added status when the account-data write fails", async () => {
        vi.spyOn(customEmotes, "getCustomEmotesForRoom").mockReturnValue([]);
        vi.mocked(client.setAccountData).mockRejectedValueOnce(new Error("offline"));
        render(<CustomEmoteInfo mxEvent={event} room={room} src={srcHttp} title="wave" alt="A friendly wave" />);

        fireEvent.click(screen.getByRole("button", { name: ":wave:" }));
        fireEvent.click(screen.getByRole("button", { name: /Add/ }));
        await waitFor(() => expect(screen.getByText("Could not save. Try again.")).toBeInTheDocument());
        expect(screen.queryByText("Saved")).toBeNull();
    });

    it("updates the saved status from an account-data event after adding", async () => {
        vi.spyOn(customEmotes, "getCustomEmotesForRoom").mockReturnValue([]);
        const remove = vi.spyOn(customEmotes, "removeUserPackEmote").mockResolvedValue(undefined);
        render(<CustomEmoteInfo mxEvent={event} room={room} src={srcHttp} title="wave" alt="A friendly wave" />);

        fireEvent.click(screen.getByRole("button", { name: ":wave:" }));
        fireEvent.click(screen.getByRole("button", { name: /Add/ }));
        await waitFor(() => expect(client.setAccountData).toHaveBeenCalled());

        const accountEvent = new MatrixEvent({
            type: LEGACY_USER_IMAGE_PACK_EVENT_TYPE,
            content: { images: { wave: { url: mxcUrl } } },
        });
        vi.mocked(client.getAccountData).mockReturnValue(accountEvent);
        act(() => client.emit(ClientEvent.AccountData, accountEvent));
        await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());

        fireEvent.click(screen.getByRole("button", { name: /Remove wave/i }));
        await waitFor(() => expect(remove).toHaveBeenCalledWith(client, "wave"));
        vi.mocked(client.getAccountData).mockReturnValue(undefined);
        act(() => client.emit(ClientEvent.AccountData, accountEvent));
        await waitFor(() => expect(screen.getByText("Remove")).toBeInTheDocument());
    });

    it("shows an error when removing a personal emote fails", async () => {
        const accountEvent = new MatrixEvent({
            type: LEGACY_USER_IMAGE_PACK_EVENT_TYPE,
            content: { images: { wave: { url: mxcUrl } } },
        });
        vi.mocked(client.getAccountData).mockReturnValue(accountEvent);
        vi.spyOn(customEmotes, "getCustomEmotesForRoom").mockReturnValue([]);
        vi.spyOn(customEmotes, "removeUserPackEmote").mockRejectedValueOnce(new Error("offline"));

        render(<CustomEmoteInfo mxEvent={event} room={room} src={srcHttp} title="wave" alt="A friendly wave" />);
        fireEvent.click(screen.getByRole("button", { name: ":wave:" }));
        fireEvent.click(screen.getByRole("button", { name: /Remove wave/i }));
        await waitFor(() => expect(screen.getByText("Could not save. Try again.")).toBeInTheDocument());
    });

    it("closes on outside pointerdown but ignores presses inside the card or trigger", () => {
        const pack: customEmotes.ResolvedImagePack = {
            roomId,
            stateKey: "room-emotes",
            displayName: "Room emotes",
            source: "room",
            content: { images: { wave: { url: mxcUrl } } },
        };
        vi.spyOn(customEmotes, "getCustomEmotesForRoom").mockReturnValue([
            { shortcode: "wave", url: mxcUrl, pack, packSlug: "room-emotes", sendToken: ":wave:" },
        ]);
        render(<CustomEmoteInfo mxEvent={event} room={room} src={srcHttp} title="wave" alt="A friendly wave" />);

        const trigger = screen.getByRole("button", { name: ":wave:" });
        fireEvent.click(trigger);
        expect(screen.queryByRole("dialog")).not.toBeNull();

        fireEvent.pointerDown(trigger);
        expect(screen.queryByRole("dialog")).not.toBeNull();

        fireEvent.pointerDown(screen.getByText("Room emotes"));
        expect(screen.queryByRole("dialog")).not.toBeNull();

        fireEvent.pointerDown(document.body);
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("shows settings instead of enable when a room pack is already globally enabled", () => {
        const pack: customEmotes.ResolvedImagePack = {
            roomId,
            stateKey: "room-emotes",
            displayName: "Room emotes",
            source: "room",
            content: { images: { wave: { url: mxcUrl } } },
        };
        vi.spyOn(customEmotes, "getCustomEmotesForRoom").mockReturnValue([
            { shortcode: "wave", url: mxcUrl, pack, packSlug: "room-emotes", sendToken: ":wave:" },
        ]);
        vi.mocked(client.getAccountData).mockImplementation((eventType) =>
            (eventType as string) === IMAGE_PACK_ROOMS_EVENT_TYPE
                ? new MatrixEvent({ type: eventType, content: { rooms: { [roomId]: { "room-emotes": {} } } } })
                : undefined,
        );

        render(<CustomEmoteInfo mxEvent={event} room={room} src={srcHttp} title="wave" alt="A friendly wave" />);
        fireEvent.click(screen.getByRole("button", { name: ":wave:" }));

        expect(screen.queryByRole("button", { name: /Enable Custom emotes/ })).toBeNull();
        expect(screen.getByRole("button", { name: /Open Custom emotes/ })).toBeInTheDocument();
    });

    it("explains unrecognised media and disables saving", () => {
        const malformedEvent = new MatrixEvent({
            type: "m.room.message",
            room_id: roomId,
            content: {
                formatted_body: `<img data-mx-emoticon="" src="https://example.org/wave" title="wave">`,
            },
        });
        vi.spyOn(customEmotes, "getCustomEmotesForRoom").mockReturnValue([]);
        render(<CustomEmoteInfo mxEvent={malformedEvent} room={room} src={srcHttp} title="wave" alt="wave" />);

        fireEvent.click(screen.getByRole("button", { name: ":wave:" }));

        expect(screen.getByText("Unrecognised emote media, so it cannot be saved.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Add/ })).toBeDisabled();
    });

    it("hides the preview when no emote source is available", () => {
        const malformedEvent = new MatrixEvent({
            type: "m.room.message",
            room_id: roomId,
            content: {
                formatted_body: `<img data-mx-emoticon="" src="https://example.org/wave" title="wave">`,
            },
        });
        vi.spyOn(customEmotes, "getCustomEmotesForRoom").mockReturnValue([]);
        render(<CustomEmoteInfo mxEvent={malformedEvent} room={room} title="wave" alt="wave" />);

        fireEvent.click(screen.getByRole("button", { name: ":wave:" }));

        expect(screen.getByRole("dialog").querySelector(".mx_CustomEmoteInfo_preview")).toBeNull();
    });

    it("associates the name field uniquely and hides the trigger image from assistive tech", () => {
        vi.spyOn(customEmotes, "getCustomEmotesForRoom").mockReturnValue([]);
        const { container } = render(
            <CustomEmoteInfo mxEvent={event} room={room} src={srcHttp} title="wave" alt="A friendly wave" />,
        );

        const triggerImage = container.querySelector(".mx_CustomEmoteInfo_trigger img");
        expect(triggerImage).toHaveAttribute("alt", "");
        expect(triggerImage).toHaveAttribute("aria-hidden", "true");

        fireEvent.click(screen.getByRole("button", { name: ":wave:" }));
        const input = screen.getByRole("textbox", { name: "Name" });
        const label = screen.getByText("Name", { selector: "label" });
        expect(input.id).toBeTruthy();
        expect(label.getAttribute("for")).toBe(input.id);
    });
});
