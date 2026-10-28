/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "test-utils-rtl";
import { EventType, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { mkEvent, stubClient, withClientContextRenderOptions } from "test-utils";

import { MA2UIBody } from "./MA2UIBody";
import { A2UI_ACTION_EVENT_TYPE, A2UI_MSGTYPE } from "../../../a2ui/A2UIEvents";
import SettingsStore from "../../../settings/SettingsStore";
import { MediaPreviewValue } from "../../../@types/media_preview";

vi.mock("./TextualBodyFactory", () => ({
    __esModule: true,
    TextualBodyFactory: () => <div data-testid="textual-body" />,
}));

const roomId = "!room:example.org";

describe("MA2UIBody", () => {
    let cli: MatrixClient;

    const mxEvent = mkEvent({
        event: true,
        type: EventType.RoomMessage,
        room: roomId,
        user: "@agent:example.org",
        content: {
            msgtype: A2UI_MSGTYPE,
            body: "fallback",
            messages: [
                {
                    version: "v0.9",
                    updateComponents: {
                        surfaceId: "main",
                        components: [
                            { id: "root", component: "Column", children: ["greeting", "picture", "ok"] },
                            { id: "greeting", component: "Text", text: "Hello from the agent" },
                            {
                                id: "picture",
                                component: "Image",
                                url: "https://example.org/picture.png",
                                description: "A picture",
                            },
                            { id: "ok", component: "Button", child: "okLabel", action: { event: { name: "ok" } } },
                            { id: "okLabel", component: "Text", text: "OK" },
                        ],
                    },
                },
            ],
        },
    });

    beforeEach(() => {
        cli = stubClient();
        vi.spyOn(cli, "sendEvent").mockResolvedValue({ event_id: "$action" });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function enableFlag(enabled: boolean, mediaPreviews: MediaPreviewValue = MediaPreviewValue.On): void {
        vi.spyOn(SettingsStore, "getValue").mockImplementation((name) => {
            switch (name) {
                case "feature_a2ui":
                    return enabled;
                case "mediaPreviewConfig":
                    return { media_previews: mediaPreviews, invite_avatars: mediaPreviews };
                case "showMediaEventIds":
                    return {};
                default:
                    return false;
            }
        });
    }

    it("renders the text fallback when the labs flag is off", () => {
        enableFlag(false);
        render(<MA2UIBody mxEvent={mxEvent} />, withClientContextRenderOptions(cli));

        expect(screen.getByTestId("textual-body")).toBeInTheDocument();
        expect(screen.queryByText("Hello from the agent")).not.toBeInTheDocument();
    });

    it("renders the text fallback for exports and non-interactive previews", () => {
        enableFlag(true);
        const { unmount } = render(<MA2UIBody mxEvent={mxEvent} forExport />, withClientContextRenderOptions(cli));
        expect(screen.getByTestId("textual-body")).toBeInTheDocument();
        unmount();

        render(<MA2UIBody mxEvent={mxEvent} inhibitInteraction />, withClientContextRenderOptions(cli));
        expect(screen.getByTestId("textual-body")).toBeInTheDocument();
    });

    it("hides media behind a placeholder when media previews are off", () => {
        enableFlag(true, MediaPreviewValue.Off);
        render(<MA2UIBody mxEvent={mxEvent} />, withClientContextRenderOptions(cli));

        expect(screen.queryByRole("img", { name: "A picture" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Show image" })).toBeInTheDocument();
    });

    it("renders the surface and sends actions when the labs flag is on", async () => {
        enableFlag(true);
        render(<MA2UIBody mxEvent={mxEvent} />, withClientContextRenderOptions(cli));

        expect(screen.getByText("Hello from the agent")).toBeInTheDocument();
        expect(screen.getByRole("img", { name: "A picture" })).toBeInTheDocument();
        screen.getByRole("button", { name: "OK" }).click();

        expect(cli.sendEvent).toHaveBeenCalledWith(
            roomId,
            A2UI_ACTION_EVENT_TYPE,
            expect.objectContaining({ action: expect.objectContaining({ name: "ok", sourceComponentId: "ok" }) }),
        );
    });
});
