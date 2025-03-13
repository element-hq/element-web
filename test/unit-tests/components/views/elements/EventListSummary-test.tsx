/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentProps } from "react";
import { render, type RenderResult } from "jest-matrix-react";
import { type MatrixEvent, RoomMember } from "matrix-js-sdk/src/matrix";
import { KnownMembership, type Membership } from "matrix-js-sdk/src/types";

import {
    getMockClientWithEventEmitter,
    mkEvent,
    mkMembership,
    mockClientMethodsUser,
    unmockClientPeg,
} from "../../../../test-utils";
import EventListSummary from "../../../../../src/components/views/elements/EventListSummary";
import { Layout } from "../../../../../src/settings/enums/Layout";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import * as languageHandler from "../../../../../src/languageHandler";

describe("EventListSummary", function () {
    const roomId = "!room:server.org";
    // Generate dummy event tiles for use in simulating an expanded MELS
    const generateTiles = (events: MatrixEvent[]) => {
        return events.map((e) => {
            return (
                <div key={e.getId()} className="event_tile">
                    Expanded membership
                </div>
            );
        });
    };

    /**
     * Generates a membership event with the target of the event set as a mocked
     * RoomMember based on `parameters.userId`.
     * @param {string} eventId the ID of the event.
     * @param {object} parameters the parameters to use to create the event.
     * @param {string} parameters.membership the membership to assign to
     * `content.membership`
     * @param {string} parameters.userId the state key and target userId of the event. If
     * `parameters.senderId` is not specified, this is also used as the event sender.
     * @param {string} parameters.prevMembership the membership to assign to
     * `prev_content.membership`.
     * @param {string} parameters.senderId the user ID of the sender of the event.
     * Optional. Defaults to `parameters.userId`.
     * @returns {MatrixEvent} the event created.
     */
    interface MembershipEventParams {
        senderId?: string;
        userId?: string;
        membership: Membership;
        prevMembership?: Membership;
    }
    const generateMembershipEvent = (
        eventId: string,
        { senderId, userId, membership, prevMembership }: MembershipEventParams & { userId: string },
    ): MatrixEvent => {
        const member = new RoomMember(roomId, userId);
        // Use localpart as display name;
        member.name = userId.match(/@([^:]*):/)![1];
        jest.spyOn(member, "getAvatarUrl").mockReturnValue("avatar.jpeg");
        jest.spyOn(member, "getMxcAvatarUrl").mockReturnValue("mxc://avatar.url/image.png");
        const e = mkMembership({
            event: true,
            room: roomId,
            user: senderId || userId,
            skey: userId,
            mship: membership,
            prevMship: prevMembership,
            target: member,
        });
        // Override random event ID to allow for equality tests against tiles from
        // generateTiles
        e.event.event_id = eventId;
        return e;
    };

    // Generate mock MatrixEvents from the array of parameters
    const generateEvents = (parameters: Array<MembershipEventParams & { userId: string }>) => {
        const res: MatrixEvent[] = [];
        for (let i = 0; i < parameters.length; i++) {
            res.push(generateMembershipEvent(`event${i}`, parameters[i]));
        }
        return res;
    };

    // Generate the same sequence of `events` for `n` users, where each user ID
    // is created by replacing the first "$" in userIdTemplate with `i` for
    // `i = 0 .. n`.
    const generateEventsForUsers = (userIdTemplate: string, n: number, events: MembershipEventParams[]) => {
        let eventsForUsers: MatrixEvent[] = [];
        let userId = "";
        for (let i = 0; i < n; i++) {
            userId = userIdTemplate.replace("$", String(i));
            events.forEach((e) => {
                e.userId = userId;
            });
            eventsForUsers = eventsForUsers.concat(
                generateEvents(events as Array<MembershipEventParams & { userId: string }>),
            );
        }
        return eventsForUsers;
    };

    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(),
    });

    const defaultProps: Omit<
        ComponentProps<typeof EventListSummary>,
        "summaryLength" | "threshold" | "avatarsMaxLength"
    > = {
        layout: Layout.Bubble,
        events: [],
        children: [],
    };
    const renderComponent = (props = {}): RenderResult => {
        return render(
            <MatrixClientContext.Provider value={mockClient}>
                <EventListSummary {...defaultProps} {...props} />
            </MatrixClientContext.Provider>,
        );
    };

    beforeEach(function () {
        jest.clearAllMocks();
        jest.spyOn(languageHandler, "getUserLanguage").mockReturnValue("en-GB");
    });

    afterAll(() => {
        unmockClientPeg();
    });

    it("renders expanded events if there are less than props.threshold", function () {
        const events = generateEvents([
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
        ]);
        const props = {
            events: events,
            children: generateTiles(events),
            summaryLength: 1,
            avatarsMaxLength: 5,
            threshold: 3,
        };

        const { container } = renderComponent(props); // matrix cli context wrapper

        const children = container.querySelector(".mx_GenericEventListSummary_unstyledList")!.children;
        expect(children).toHaveLength(1);
        expect(children[0]).toHaveTextContent("Expanded membership");
    });

    it("renders expanded events if there are less than props.threshold for join and leave", function () {
        const events = generateEvents([
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
        ]);
        const props = {
            events: events,
            children: generateTiles(events),
            summaryLength: 1,
            avatarsMaxLength: 5,
            threshold: 3,
        };

        const { container } = renderComponent(props); // matrix cli context wrapper

        const children = container.querySelector(".mx_GenericEventListSummary_unstyledList")!.children;
        expect(children).toHaveLength(2);
        expect(children[0]).toHaveTextContent("Expanded membership");
        expect(children[1]).toHaveTextContent("Expanded membership");
    });

    it("renders collapsed events if events.length = props.threshold", function () {
        const events = generateEvents([
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
        ]);
        const props = {
            events: events,
            children: generateTiles(events),
            summaryLength: 1,
            avatarsMaxLength: 5,
            threshold: 3,
        };

        const { container } = renderComponent(props);
        const summary = container.querySelector(".mx_GenericEventListSummary_summary");
        expect(summary).toHaveTextContent("user_1 joined and left and joined");
    });

    it("truncates long join,leave repetitions", function () {
        const events = generateEvents([
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
        ]);
        const props = {
            events: events,
            children: generateTiles(events),
            summaryLength: 1,
            avatarsMaxLength: 5,
            threshold: 3,
        };

        const { container } = renderComponent(props);
        const summary = container.querySelector(".mx_GenericEventListSummary_summary");
        expect(summary).toHaveTextContent("user_1 joined and left 7 times");
    });

    it("truncates long join,leave repetitions between other events", function () {
        const events = generateEvents([
            {
                userId: "@user_1:some.domain",
                prevMembership: KnownMembership.Ban,
                membership: KnownMembership.Leave,
                senderId: "@some_other_user:some.domain",
            },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            {
                userId: "@user_1:some.domain",
                prevMembership: KnownMembership.Leave,
                membership: KnownMembership.Invite,
                senderId: "@some_other_user:some.domain",
            },
        ]);
        const props = {
            events: events,
            children: generateTiles(events),
            summaryLength: 1,
            avatarsMaxLength: 5,
            threshold: 3,
        };

        const { container } = renderComponent(props);
        const summary = container.querySelector(".mx_GenericEventListSummary_summary");
        expect(summary).toHaveTextContent("user_1 was unbanned, joined and left 7 times and was invited");
    });

    it("truncates multiple sequences of repetitions with other events between", function () {
        const events = generateEvents([
            {
                userId: "@user_1:some.domain",
                prevMembership: KnownMembership.Ban,
                membership: KnownMembership.Leave,
                senderId: "@some_other_user:some.domain",
            },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            {
                userId: "@user_1:some.domain",
                prevMembership: KnownMembership.Leave,
                membership: KnownMembership.Ban,
                senderId: "@some_other_user:some.domain",
            },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Ban, membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            {
                userId: "@user_1:some.domain",
                prevMembership: KnownMembership.Leave,
                membership: KnownMembership.Invite,
                senderId: "@some_other_user:some.domain",
            },
        ]);
        const props = {
            events: events,
            children: generateTiles(events),
            summaryLength: 1,
            avatarsMaxLength: 5,
            threshold: 3,
        };

        const { container } = renderComponent(props);
        const summary = container.querySelector(".mx_GenericEventListSummary_summary");
        expect(summary).toHaveTextContent(
            "user_1 was unbanned, joined and left 2 times, was banned, " + "joined and left 3 times and was invited",
        );
    });

    it("handles multiple users following the same sequence of memberships", function () {
        const events = generateEvents([
            // user_1
            {
                userId: "@user_1:some.domain",
                prevMembership: KnownMembership.Ban,
                membership: KnownMembership.Leave,
                senderId: "@some_other_user:some.domain",
            },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            {
                userId: "@user_1:some.domain",
                prevMembership: KnownMembership.Leave,
                membership: KnownMembership.Ban,
                senderId: "@some_other_user:some.domain",
            },
            // user_2
            {
                userId: "@user_2:some.domain",
                prevMembership: KnownMembership.Ban,
                membership: KnownMembership.Leave,
                senderId: "@some_other_user:some.domain",
            },
            { userId: "@user_2:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_2:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            { userId: "@user_2:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_2:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            {
                userId: "@user_2:some.domain",
                prevMembership: KnownMembership.Leave,
                membership: KnownMembership.Ban,
                senderId: "@some_other_user:some.domain",
            },
        ]);
        const props = {
            events: events,
            children: generateTiles(events),
            summaryLength: 1,
            avatarsMaxLength: 5,
            threshold: 3,
        };

        const { container } = renderComponent(props);
        const summary = container.querySelector(".mx_GenericEventListSummary_summary");
        expect(summary).toHaveTextContent(
            "user_1 and one other were unbanned, joined and left 2 times and were banned",
        );
    });

    it("handles many users following the same sequence of memberships", function () {
        const events = generateEventsForUsers("@user_$:some.domain", 20, [
            {
                prevMembership: KnownMembership.Ban,
                membership: KnownMembership.Leave,
                senderId: "@some_other_user:some.domain",
            },
            { prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            { prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            {
                prevMembership: KnownMembership.Leave,
                membership: KnownMembership.Ban,
                senderId: "@some_other_user:some.domain",
            },
        ]);
        const props = {
            events: events,
            children: generateTiles(events),
            summaryLength: 1,
            avatarsMaxLength: 5,
            threshold: 3,
        };

        const { container } = renderComponent(props);
        const summary = container.querySelector(".mx_GenericEventListSummary_summary");
        expect(summary).toHaveTextContent(
            "user_0 and 19 others were unbanned, joined and left 2 times and were banned",
        );
    });

    it("correctly orders sequences of transitions by the order of their first event", function () {
        const events = generateEvents([
            {
                userId: "@user_2:some.domain",
                prevMembership: KnownMembership.Ban,
                membership: KnownMembership.Leave,
                senderId: "@some_other_user:some.domain",
            },
            {
                userId: "@user_1:some.domain",
                prevMembership: KnownMembership.Ban,
                membership: KnownMembership.Leave,
                senderId: "@some_other_user:some.domain",
            },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            {
                userId: "@user_1:some.domain",
                prevMembership: KnownMembership.Leave,
                membership: KnownMembership.Ban,
                senderId: "@some_other_user:some.domain",
            },
            { userId: "@user_2:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_2:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            { userId: "@user_2:some.domain", prevMembership: KnownMembership.Leave, membership: KnownMembership.Join },
            { userId: "@user_2:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
        ]);
        const props = {
            events: events,
            children: generateTiles(events),
            summaryLength: 1,
            avatarsMaxLength: 5,
            threshold: 3,
        };

        const { container } = renderComponent(props);
        const summary = container.querySelector(".mx_GenericEventListSummary_summary");
        expect(summary).toHaveTextContent(
            "user_2 was unbanned and joined and left 2 times, user_1 was unbanned, " +
                "joined and left 2 times and was banned",
        );
    });

    it("correctly identifies transitions", function () {
        const events = generateEvents([
            // invited
            { userId: "@user_1:some.domain", membership: KnownMembership.Invite },
            // banned
            { userId: "@user_1:some.domain", membership: KnownMembership.Ban },
            // joined
            { userId: "@user_1:some.domain", membership: KnownMembership.Join },
            // invite_reject
            {
                userId: "@user_1:some.domain",
                prevMembership: KnownMembership.Invite,
                membership: KnownMembership.Leave,
            },
            // left
            { userId: "@user_1:some.domain", prevMembership: KnownMembership.Join, membership: KnownMembership.Leave },
            // invite_withdrawal
            {
                userId: "@user_1:some.domain",
                prevMembership: KnownMembership.Invite,
                membership: KnownMembership.Leave,
                senderId: "@some_other_user:some.domain",
            },
            // unbanned
            {
                userId: "@user_1:some.domain",
                prevMembership: KnownMembership.Ban,
                membership: KnownMembership.Leave,
                senderId: "@some_other_user:some.domain",
            },
            // kicked
            {
                userId: "@user_1:some.domain",
                prevMembership: KnownMembership.Join,
                membership: KnownMembership.Leave,
                senderId: "@some_other_user:some.domain",
            },
            // default for sender=target (leave)
            {
                userId: "@user_1:some.domain",
                prevMembership: "????" as Membership,
                membership: KnownMembership.Leave,
                senderId: "@user_1:some.domain",
            },
            // default for sender<>target (kicked)
            {
                userId: "@user_1:some.domain",
                prevMembership: "????" as Membership,
                membership: KnownMembership.Leave,
                senderId: "@some_other_user:some.domain",
            },
        ]);
        const props = {
            events: events,
            children: generateTiles(events),
            summaryLength: 1,
            avatarsMaxLength: 5,
            threshold: 3,
        };

        const { container } = renderComponent(props);
        const summary = container.querySelector(".mx_GenericEventListSummary_summary");
        expect(summary).toHaveTextContent(
            "user_1 was invited, was banned, joined, rejected their invitation, left, " +
                "had their invitation withdrawn, was unbanned, was removed, left and was removed",
        );
    });

    it("handles invitation plurals correctly when there are multiple users", function () {
        const events = generateEvents([
            {
                userId: "@user_1:some.domain",
                prevMembership: KnownMembership.Invite,
                membership: KnownMembership.Leave,
            },
            {
                userId: "@user_1:some.domain",
                prevMembership: KnownMembership.Invite,
                membership: KnownMembership.Leave,
                senderId: "@some_other_user:some.domain",
            },
            {
                userId: "@user_2:some.domain",
                prevMembership: KnownMembership.Invite,
                membership: KnownMembership.Leave,
            },
            {
                userId: "@user_2:some.domain",
                prevMembership: KnownMembership.Invite,
                membership: KnownMembership.Leave,
                senderId: "@some_other_user:some.domain",
            },
        ]);
        const props = {
            events: events,
            children: generateTiles(events),
            summaryLength: 1,
            avatarsMaxLength: 5,
            threshold: 3,
        };

        const { container } = renderComponent(props);
        const summary = container.querySelector(".mx_GenericEventListSummary_summary");
        expect(summary).toHaveTextContent(
            "user_1 and one other rejected their invitations and had their invitations withdrawn",
        );
    });

    it("handles invitation plurals correctly when there are multiple invites", function () {
        const events = generateEvents([
            {
                userId: "@user_1:some.domain",
                prevMembership: KnownMembership.Invite,
                membership: KnownMembership.Leave,
            },
            {
                userId: "@user_1:some.domain",
                prevMembership: KnownMembership.Invite,
                membership: KnownMembership.Leave,
            },
        ]);
        const props = {
            events: events,
            children: generateTiles(events),
            summaryLength: 1,
            avatarsMaxLength: 5,
            threshold: 1, // threshold = 1 to force collapse
        };

        const { container } = renderComponent(props);
        const summary = container.querySelector(".mx_GenericEventListSummary_summary");
        expect(summary).toHaveTextContent("user_1 rejected their invitation 2 times");
    });

    it('handles a summary length = 2, with no "others"', function () {
        const events = generateEvents([
            { userId: "@user_1:some.domain", membership: KnownMembership.Join },
            { userId: "@user_1:some.domain", membership: KnownMembership.Join },
            { userId: "@user_2:some.domain", membership: KnownMembership.Join },
            { userId: "@user_2:some.domain", membership: KnownMembership.Join },
        ]);
        const props = {
            events: events,
            children: generateTiles(events),
            summaryLength: 2,
            avatarsMaxLength: 5,
            threshold: 3,
        };

        const { container } = renderComponent(props);
        const summary = container.querySelector(".mx_GenericEventListSummary_summary");
        expect(summary).toHaveTextContent("user_1 and user_2 joined 2 times");
    });

    it('handles a summary length = 2, with 1 "other"', function () {
        const events = generateEvents([
            { userId: "@user_1:some.domain", membership: KnownMembership.Join },
            { userId: "@user_2:some.domain", membership: KnownMembership.Join },
            { userId: "@user_3:some.domain", membership: KnownMembership.Join },
        ]);
        const props = {
            events: events,
            children: generateTiles(events),
            summaryLength: 2,
            avatarsMaxLength: 5,
            threshold: 3,
        };

        const { container } = renderComponent(props);
        const summary = container.querySelector(".mx_GenericEventListSummary_summary");
        expect(summary).toHaveTextContent("user_1, user_2 and one other joined");
    });

    it('handles a summary length = 2, with many "others"', function () {
        const events = generateEventsForUsers("@user_$:some.domain", 20, [{ membership: KnownMembership.Join }]);
        const props = {
            events: events,
            children: generateTiles(events),
            summaryLength: 2,
            avatarsMaxLength: 5,
            threshold: 3,
        };

        const { container } = renderComponent(props);
        const summary = container.querySelector(".mx_GenericEventListSummary_summary");
        expect(summary).toHaveTextContent("user_0, user_1 and 18 others joined");
    });

    it("should not blindly group 3pid invites and treat them as distinct users instead", () => {
        const events = [
            mkEvent({
                event: true,
                skey: "randomstring1",
                user: "@user1:server",
                type: "m.room.third_party_invite",
                content: {
                    display_name: "n...@d...",
                    key_validity_url: "https://blah",
                    public_key: "public_key",
                },
            }),
            mkEvent({
                event: true,
                skey: "randomstring2",
                user: "@user1:server",
                type: "m.room.third_party_invite",
                content: {
                    display_name: "n...@d...",
                    key_validity_url: "https://blah",
                    public_key: "public_key",
                },
            }),
            mkEvent({
                event: true,
                skey: "randomstring3",
                user: "@user1:server",
                type: "m.room.third_party_invite",
                content: {
                    display_name: "d...@w...",
                    key_validity_url: "https://blah",
                    public_key: "public_key",
                },
            }),
        ];

        const props = {
            events: events,
            children: generateTiles(events),
            summaryLength: 2,
            avatarsMaxLength: 5,
            threshold: 3,
        };

        const { container } = renderComponent(props);
        const summary = container.querySelector(".mx_GenericEventListSummary_summary");
        expect(summary).toHaveTextContent("n...@d... was invited 2 times, d...@w... was invited");
    });
});
