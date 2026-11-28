/*
Copyright 2024-2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, type RenderResult } from "test-utils-rtl";
import {
    MatrixEvent,
    ConditionKind,
    EventType,
    PushRuleActionName,
    Room,
    TweakName,
    type MatrixClient,
} from "matrix-js-sdk/src/matrix";
import parse from "html-react-parser";
import { PushProcessor } from "matrix-js-sdk/src/pushprocessor";

import { stubClient, TestSDKContext, withClientContextRenderOptions } from "test-utils";
import { keywordPillRenderer, mentionPillRenderer, combineRenderers } from "./index";
import { SDKContext } from "../contexts/SDKContext";
import { MatrixClientPeg } from "../MatrixClientPeg";
import DMRoomMap from "../utils/DMRoomMap";

describe("mention pills", () => {
    let cli: MatrixClient;
    let room: Room;
    const roomId = "!room:id";
    const event = new MatrixEvent({
        room_id: roomId,
        type: EventType.RoomMessage,
        content: {
            body: "@room",
        },
    });

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();
        // @ts-expect-error
        cli.pushProcessor = new PushProcessor(cli);
        room = new Room(roomId, cli, cli.getUserId()!);
        room.currentState.mayTriggerNotifOfType = vi.fn().mockReturnValue(true);
        vi.mocked(cli.getRoom).mockReturnValue(room);
        cli.pushRules!.global = {
            override: [
                {
                    rule_id: ".m.rule.roomnotif",
                    default: true,
                    enabled: true,
                    conditions: [
                        {
                            kind: ConditionKind.EventMatch,
                            key: "content.body",
                            pattern: "@room",
                        },
                    ],
                    actions: [
                        PushRuleActionName.Notify,
                        {
                            set_tweak: TweakName.Highlight,
                            value: true,
                        },
                    ],
                },
                {
                    rule_id: ".m.rule.is_room_mention",
                    default: true,
                    enabled: true,
                    conditions: [
                        {
                            kind: ConditionKind.EventPropertyIs,
                            key: "content.m\\.mentions.room",
                            value: true,
                        },
                        {
                            kind: ConditionKind.SenderNotificationPermission,
                            key: "room",
                        },
                    ],
                    actions: [
                        PushRuleActionName.Notify,
                        {
                            set_tweak: TweakName.Highlight,
                        },
                    ],
                },
            ],
        };

        DMRoomMap.makeShared(cli);
    });

    function renderPills(input: string, mxEvent?: MatrixEvent, isHtml = true): RenderResult {
        // User pills look up profiles through the SDK context
        const sdkContext = new TestSDKContext();
        sdkContext._client = cli;
        return render(
            <SDKContext.Provider value={sdkContext}>
                {parse(input, {
                    replace: combineRenderers(mentionPillRenderer)({
                        mxEvent: mxEvent ?? event,
                        room,
                        isHtml,
                    }),
                })}
            </SDKContext.Provider>,
            withClientContextRenderOptions(cli),
        );
    }

    it("should do nothing for empty element", () => {
        const input = "<div></div>";
        const { asFragment } = renderPills(input);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should pillify @room", () => {
        const input = "<div>@room</div>";
        const { container, asFragment } = renderPills(input);
        expect(asFragment()).toMatchSnapshot();
        expect(container.querySelector(".mx_Pill.mx_AtRoomPill")?.textContent).toBe("!@room");
    });

    it("should pillify @room in an intentional mentions world", () => {
        vi.mocked(MatrixClientPeg.safeGet().supportsIntentionalMentions).mockReturnValue(true);
        const { container, asFragment } = renderPills(
            "<div>@room</div>",
            new MatrixEvent({
                room_id: roomId,
                type: EventType.RoomMessage,
                content: {
                    "body": "@room",
                    "m.mentions": {
                        room: true,
                    },
                },
            }),
        );
        expect(asFragment()).toMatchSnapshot();
        expect(container.querySelector(".mx_Pill.mx_AtRoomPill")?.textContent).toBe("!@room");
    });

    describe("linkified links in plain-text messages", () => {
        it("should pillify a matrix.to user permalink", () => {
            const href = "https://matrix.to/#/@user:example.org";
            const { container } = renderPills(`<div><a href="${href}">${href}</a></div>`, undefined, false);
            expect(container.querySelector(".mx_Pill.mx_UserPill")).not.toBeNull();
        });

        it("should pillify a matrix: user URI", () => {
            const { container } = renderPills(
                `<div><a href="https://matrix.to/#/@user:example.org">matrix:u/user:example.org</a></div>`,
                undefined,
                false,
            );
            expect(container.querySelector(".mx_Pill.mx_UserPill")).not.toBeNull();
        });

        it("should pillify a matrix: event URI", () => {
            const { container } = renderPills(
                `<div><a href="https://matrix.to/#/!room:example.org/$event">matrix:roomid/room:example.org/e/event</a></div>`,
                undefined,
                false,
            );
            expect(container.querySelector(".mx_Pill")).not.toBeNull();
        });

        it("should not pillify a permalink with a custom label", () => {
            const { container } = renderPills(
                `<div><a href="https://matrix.to/#/@user:example.org">some label</a></div>`,
                undefined,
                false,
            );
            expect(container.querySelector(".mx_Pill")).toBeNull();
        });
    });
});

describe("keyword pills", () => {
    let cli: MatrixClient;
    const keywordRegexpPattern = /(test)/i;

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();
        cli.pushRules!.global = {
            override: [
                {
                    rule_id: ".m.rule.roomnotif",
                    default: true,
                    enabled: true,
                    conditions: [
                        {
                            kind: ConditionKind.EventMatch,
                            key: "content.body",
                            pattern: "@room",
                        },
                    ],
                    actions: [
                        PushRuleActionName.Notify,
                        {
                            set_tweak: TweakName.Highlight,
                            value: true,
                        },
                    ],
                },
                {
                    rule_id: ".m.rule.is_room_mention",
                    default: true,
                    enabled: true,
                    conditions: [
                        {
                            kind: ConditionKind.EventPropertyIs,
                            key: "content.m\\.mentions.room",
                            value: true,
                        },
                        {
                            kind: ConditionKind.SenderNotificationPermission,
                            key: "room",
                        },
                    ],
                    actions: [
                        PushRuleActionName.Notify,
                        {
                            set_tweak: TweakName.Highlight,
                        },
                    ],
                },
            ],
        };

        DMRoomMap.makeShared(cli);
    });

    function renderPills(input: string): RenderResult {
        return render(
            <>
                {parse(input, {
                    replace: combineRenderers(keywordPillRenderer)({
                        isHtml: true,
                        keywordRegexpPattern,
                    }),
                })}
            </>,
            withClientContextRenderOptions(cli),
        );
    }

    it("should do nothing for empty element", () => {
        const input = "<div></div>";
        const { asFragment } = renderPills(input);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should pillify", () => {
        const input = "<div>Foo TeST Bar</div>";
        const { container, asFragment } = renderPills(input);
        expect(asFragment()).toMatchSnapshot();
        expect(container.querySelector(".mx_Pill.mx_KeywordPill")?.textContent).toBe("TeST");
    });
});
