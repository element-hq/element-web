/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { MatrixEvent, EventType, type MatrixClient } from "matrix-js-sdk/src/matrix";
import sanitizeHtml from "sanitize-html";
import parse from "html-react-parser";
import { render, type RenderResult } from "jest-matrix-react";

import { customEmoteRenderer, combineRenderers } from "../../../src/renderer";
import { sanitizeHtmlParams } from "../../../src/Linkify";
import { stubClient, withClientContextRenderOptions } from "../../test-utils";

describe("custom emote renderer", () => {
    let client: MatrixClient;

    beforeEach(() => {
        client = stubClient();
    });

    function renderBody(html: string, event: MatrixEvent): RenderResult {
        const sanitized = sanitizeHtml(html, sanitizeHtmlParams);
        return render(
            <>
                {parse(sanitized, { replace: combineRenderers(customEmoteRenderer)({ isHtml: true, mxEvent: event }) })}
            </>,
            withClientContextRenderOptions(client),
        );
    }

    it("recognizes sanitizer output with an empty emote attribute", () => {
        const raw = '<img data-mx-emoticon="" src="mxc://example.org/wave" alt="A wave" title="wave" height="32">';
        const event = new MatrixEvent({
            type: EventType.RoomMessage,
            room_id: "!room:example.org",
            content: {
                body: ":wave:",
                msgtype: "m.text",
                format: "org.matrix.custom.html",
                formatted_body: raw,
            },
        });

        const { container } = renderBody(raw, event);
        const image = container.querySelector<HTMLImageElement>("img[data-mx-emoticon]");

        expect(image).toBeTruthy();
        expect(image?.title).toBe("wave");
        expect(image?.closest("button")).toBeTruthy();
    });
});
