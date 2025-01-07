/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { act, render } from "jest-matrix-react";
import { MatrixEvent, ConditionKind, EventType, PushRuleActionName, Room, TweakName } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import { pillifyLinks } from "../../../src/utils/pillify";
import { stubClient } from "../../test-utils";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import DMRoomMap from "../../../src/utils/DMRoomMap";
import { ReactRootManager } from "../../../src/utils/react.tsx";

describe("pillify", () => {
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
        const cli = MatrixClientPeg.safeGet();
        const room = new Room(roomId, cli, cli.getUserId()!);
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

    it("should do nothing for empty element", () => {
        const { container } = render(<div />);
        const originalHtml = container.outerHTML;
        const containers = new ReactRootManager();
        pillifyLinks(MatrixClientPeg.safeGet(), [container], event, containers);
        expect(containers.elements).toHaveLength(0);
        expect(container.outerHTML).toEqual(originalHtml);
    });

    it("should pillify @room", () => {
        const { container } = render(<div>@room</div>);
        const containers = new ReactRootManager();
        act(() => pillifyLinks(MatrixClientPeg.safeGet(), [container], event, containers));
        expect(containers.elements).toHaveLength(1);
        expect(container.querySelector(".mx_Pill.mx_AtRoomPill")?.textContent).toBe("!@room");
    });

    it("should pillify @room in an intentional mentions world", () => {
        mocked(MatrixClientPeg.safeGet().supportsIntentionalMentions).mockReturnValue(true);
        const { container } = render(<div>@room</div>);
        const containers = new ReactRootManager();
        act(() =>
            pillifyLinks(
                MatrixClientPeg.safeGet(),
                [container],
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
                containers,
            ),
        );
        expect(containers.elements).toHaveLength(1);
        expect(container.querySelector(".mx_Pill.mx_AtRoomPill")?.textContent).toBe("!@room");
    });

    it("should not double up pillification on repeated calls", () => {
        const { container } = render(<div>@room</div>);
        const containers = new ReactRootManager();
        act(() => {
            pillifyLinks(MatrixClientPeg.safeGet(), [container], event, containers);
            pillifyLinks(MatrixClientPeg.safeGet(), [container], event, containers);
            pillifyLinks(MatrixClientPeg.safeGet(), [container], event, containers);
            pillifyLinks(MatrixClientPeg.safeGet(), [container], event, containers);
        });
        expect(containers.elements).toHaveLength(1);
        expect(container.querySelector(".mx_Pill.mx_AtRoomPill")?.textContent).toBe("!@room");
    });
});
