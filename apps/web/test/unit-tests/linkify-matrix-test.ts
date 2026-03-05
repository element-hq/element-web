/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import type { linkifyjs } from "@element-hq/web-shared-components";
import { roomAliasEventListeners, userIdEventListeners } from "../../src/Linkify";
import dispatcher from "../../src/dispatcher/dispatcher";
import { Action } from "../../src/dispatcher/actions";

describe("linkify-matrix", () => {
    describe("roomalias plugin", () => {
        it("should intercept clicks with a ViewRoom dispatch", () => {
            const dispatchSpy = jest.spyOn(dispatcher, "dispatch");

            const handlers = roomAliasEventListeners("#room:server.com");
            const event = new MouseEvent("mousedown");
            event.preventDefault = jest.fn();
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
            const dispatchSpy = jest.spyOn(dispatcher, "dispatch");

            const handlers = userIdEventListeners("@localpart:server.com");

            const event = new MouseEvent("mousedown");
            event.preventDefault = jest.fn();
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
});
