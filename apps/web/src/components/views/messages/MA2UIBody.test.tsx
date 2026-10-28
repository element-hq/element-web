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
import { LinkedTextContext } from "@element-hq/web-shared-components";
import { mkEvent, stubClient, withClientContextRenderOptions } from "test-utils";

import { MA2UIBody } from "./MA2UIBody";
import { A2UI_ACTION_EVENT_TYPE, A2UI_MSGTYPE } from "../../../a2ui/A2UIEvents";
import SettingsStore from "../../../settings/SettingsStore";
import { MediaPreviewValue } from "../../../@types/media_preview";
import { LinkedTextConfiguration } from "../../../Linkify";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";

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

    it("opens matrix.to links and matrix: URIs in openUrl buttons inside the app and other links in a new tab", () => {
        enableFlag(true);
        const openUrl = (id: string, label: string, url: string) => [
            {
                id,
                component: "Button",
                child: `${id}Label`,
                action: { functionCall: { call: "openUrl", args: { url } } },
            },
            { id: `${id}Label`, component: "Text", text: label },
        ];
        const linksEvent = mkEvent({
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
                                { id: "root", component: "Row", children: ["user", "room", "uri", "web"] },
                                ...openUrl("user", "Speaker", "https://matrix.to/#/@alice:example.org"),
                                ...openUrl("room", "Room", "https://matrix.to/#/#conference:example.org"),
                                ...openUrl("uri", "Organiser", "matrix:u/bob:example.org"),
                                ...openUrl("web", "Website", "https://example.org/"),
                            ],
                        },
                    },
                ],
            },
        });
        const dispatch = vi.spyOn(defaultDispatcher, "dispatch").mockImplementation(() => {});
        render(
            <LinkedTextContext.Provider value={LinkedTextConfiguration}>
                <MA2UIBody mxEvent={linksEvent} />
            </LinkedTextContext.Provider>,
            withClientContextRenderOptions(cli),
        );

        const userLink = screen.getByRole("link", { name: "Speaker" });
        expect(userLink).not.toHaveAttribute("target");
        userLink.click();
        expect(dispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                action: Action.ViewUser,
                member: expect.objectContaining({ userId: "@alice:example.org" }),
            }),
        );

        const roomLink = screen.getByRole("link", { name: "Room" });
        expect(roomLink).not.toHaveAttribute("target");
        roomLink.click();
        expect(globalThis.location.hash).toBe("#/room/#conference:example.org");
        globalThis.location.hash = "";

        const uriLink = screen.getByRole("link", { name: "Organiser" });
        expect(uriLink).toHaveAttribute("href", "https://matrix.to/#/@bob:example.org");
        expect(uriLink).not.toHaveAttribute("target");
        uriLink.click();
        expect(dispatch).toHaveBeenLastCalledWith(
            expect.objectContaining({
                action: Action.ViewUser,
                member: expect.objectContaining({ userId: "@bob:example.org" }),
            }),
        );

        expect(screen.getByRole("link", { name: "Website" })).toHaveAttribute("target", "_blank");
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
