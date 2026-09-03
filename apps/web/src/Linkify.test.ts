/*
Copyright 2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import sanitizeHtml from "sanitize-html";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { stubClient } from "test-utils";

import { roomAliasEventListeners, sanitizeHtmlParams, userIdEventListeners } from "./Linkify";
import dispatcher from "./dispatcher/dispatcher";
import { Action } from "./dispatcher/actions";

describe("message HTML image sanitization", () => {
    let client: MatrixClient;

    beforeAll(() => {
        client = stubClient();
    });

    it("uses original media for marked emotes so animated images keep playing", () => {
        const mxc = "mxc://chat.blahaj.zone/laCwNVWurgvCaOTQUpxtwyrf";
        const html = sanitizeHtml(
            `<img data-mx-emoticon src="${mxc}" alt="kissercat-lick" title="kissercat-lick" height="32">`,
            sanitizeHtmlParams,
        );
        expect(html).toContain("data-mx-emoticon");
        expect(html).toContain('alt="kissercat-lick"');
        expect(html).toContain('title="kissercat-lick"');
        expect(html).toContain("http://this.is.a.url/chat.blahaj.zone/laCwNVWurgvCaOTQUpxtwyrf");
        expect(html).toContain("max-height:32px");
        // eslint-disable-next-line no-restricted-properties
        expect(client.mxcUrlToHttp).toHaveBeenLastCalledWith(mxc, undefined, undefined, undefined, false, true);
    });

    it("does not make an unsafe image source renderable", () => {
        const html = sanitizeHtml(
            '<img data-mx-emoticon src="https://example.org/wave.png" alt="A wave">',
            sanitizeHtmlParams,
        );
        expect(html).not.toContain("https://example.org/wave.png");
        expect(html).not.toContain("data-mx-emoticon");
    });

    it("does not mark ordinary inline images as emotes", () => {
        // eslint-disable-next-line no-restricted-properties
        vi.mocked(client.mxcUrlToHttp).mockClear();
        const html = sanitizeHtml('<img src="mxc://example.org/image" alt="An image">', sanitizeHtmlParams);
        expect(html).not.toContain("data-mx-emoticon");
        expect(html).toContain('alt="An image"');
        // eslint-disable-next-line no-restricted-properties
        expect(client.mxcUrlToHttp).toHaveBeenLastCalledWith("mxc://example.org/image", 800, 600, "scale", false, true);
    });
});

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
});
