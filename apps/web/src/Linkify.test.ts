/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, onTestFinished } from "vitest";
import { getMockClientWithEventEmitter } from "test-utils";

import { roomAliasEventListeners, transformTags, userIdEventListeners } from "./Linkify";
import dispatcher from "./dispatcher/dispatcher";
import { Action } from "./dispatcher/actions";
import * as permalinkUtils from "./utils/permalinks/Permalinks";
import SettingsStore from "./settings/SettingsStore";

describe("linkify-matrix", () => {
    describe("roomalias plugin", () => {
        it("should intercept clicks with a ViewRoom dispatch", () => {
            const dispatchSpy = vi.spyOn(dispatcher, "dispatch").mockImplementation(() => {});

            const handlers = roomAliasEventListeners("#room:server.com");
            const event = new MouseEvent("mousedown");
            event.preventDefault = vi.fn();
            handlers!.click(event);
            expect(event.preventDefault).toHaveBeenCalled();
            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: Action.ViewRoom,
                    room_alias: "#room:server.com",
                }),
            );
        });
    });

    describe("userid plugin", () => {
        it("should intercept clicks with a ViewUser dispatch", () => {
            const dispatchSpy = vi.spyOn(dispatcher, "dispatch").mockImplementation(() => {});

            const handlers = userIdEventListeners("@localpart:server.com");

            const event = new MouseEvent("mousedown");
            event.preventDefault = vi.fn();
            handlers!.click(event);
            expect(event.preventDefault).toHaveBeenCalled();
            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: Action.ViewUser,
                    member: expect.objectContaining({
                        userId: "@localpart:server.com",
                    }),
                }),
            );
        });
    });

    it("keeps application permalinks local", () => {
        const permalinkSpy = vi
            .spyOn(permalinkUtils, "tryTransformPermalinkToLocalHref")
            .mockReturnValue("#/room/!room:server");

        const result = transformTags.a("a", { href: "https://matrix.to/#/!room:server" });

        expect(result.attribs).toEqual({
            href: "https://matrix.to/#/!room:server",
            rel: "noreferrer noopener",
        });
        permalinkSpy.mockRestore();
    });

    it.each([true, false])(
        "requests animated thumbnails for custom emoticons when autoplayGifs is %s",
        (autoplayGifs) => {
            const getValue = vi
                .spyOn(SettingsStore, "getValue")
                .mockImplementation((name) => name === "autoplayGifs" && autoplayGifs);
            onTestFinished(() => getValue.mockRestore());
            getMockClientWithEventEmitter({ baseUrl: "https://server" });

            const emoticon = transformTags.img("img", {
                "src": "mxc://server/emoticon",
                "data-mx-emoticon": "",
                "height": "32",
            });
            const image = transformTags.img("img", { src: "mxc://server/image" });

            const emoticonUrl = new URL(emoticon.attribs.src!);
            expect(emoticonUrl.pathname).toBe("/_matrix/media/v3/thumbnail/server/emoticon");
            expect(emoticonUrl.searchParams.get("animated")).toBe(String(autoplayGifs));
            const imageUrl = new URL(image.attribs.src!);
            expect(imageUrl.pathname).toBe("/_matrix/media/v3/thumbnail/server/image");
            expect(imageUrl.searchParams.has("animated")).toBe(false);
        },
    );
});
