/*
Copyright 2024-2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, type RenderResult } from "jest-matrix-react";
import {
    MatrixEvent,
    ConditionKind,
    EventType,
    PushRuleActionName,
    Room,
    TweakName,
    type MatrixClient,
} from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";
import parse from "html-react-parser";
import { PushProcessor } from "matrix-js-sdk/src/pushprocessor";

import { keywordPillRenderer, mentionPillRenderer, combineRenderers } from "../../../src/renderer";
import { stubClient, withClientContextRenderOptions } from "../../test-utils";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import DMRoomMap from "../../../src/utils/DMRoomMap";

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
        room.currentState.mayTriggerNotifOfType = jest.fn().mockReturnValue(true);
        (cli.getRoom as jest.Mock).mockReturnValue(room);
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

    function renderPills(input: string, mxEvent?: MatrixEvent): RenderResult {
        return render(
            <>
                {parse(input, {
                    replace: combineRenderers(mentionPillRenderer)({
                        mxEvent: mxEvent ?? event,
                        room,
                        isHtml: true,
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

    it("should pillify @room", () => {
        const input = "<div>@room</div>";
        const { container, asFragment } = renderPills(input);
        expect(asFragment()).toMatchSnapshot();
        expect(container.querySelector(".mx_Pill.mx_AtRoomPill")?.textContent).toBe("!@room");
    });

    it("should pillify @room in an intentional mentions world", () => {
        mocked(MatrixClientPeg.safeGet().supportsIntentionalMentions).mockReturnValue(true);
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
