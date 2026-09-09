/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";

import { roomAliasEventListeners, transformTags, userIdEventListeners } from "./Linkify";
import dispatcher from "./dispatcher/dispatcher";
import { Action } from "./dispatcher/actions";
import * as permalinkUtils from "./utils/permalinks/Permalinks";

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
});
