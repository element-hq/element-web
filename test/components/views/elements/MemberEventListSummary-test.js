import React from 'react';
import ReactTestUtils from 'react-dom/test-utils';
import ShallowRenderer from "react-test-renderer/shallow";
import sdk from '../../../skinned-sdk';
import * as testUtils from '../../../test-utils';

// Give MELS a matrixClient in its child context
const MemberEventListSummary = testUtils.wrapInMatrixClientContext(
    sdk.getComponent('views.elements.MemberEventListSummary'),
);

describe('MemberEventListSummary', function() {
    // Generate dummy event tiles for use in simulating an expanded MELS
    const generateTiles = (events) => {
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
    const generateMembershipEvent = (eventId, parameters) => {
        const e = testUtils.mkMembership({
            event: true,
            user: parameters.senderId || parameters.userId,
            skey: parameters.userId,
            mship: parameters.membership,
            prevMship: parameters.prevMembership,
            target: {
                // Use localpart as display name
                name: parameters.userId.match(/@([^:]*):/)[1],
                userId: parameters.userId,
                getAvatarUrl: () => {
                    return "avatar.jpeg";
                },
            },
        });
        // Override random event ID to allow for equality tests against tiles from
        // generateTiles
        e.event.event_id = eventId;
        return e;
    };

    // Generate mock MatrixEvents from the array of parameters
    const generateEvents = (parameters) => {
        const res = [];
        for (let i = 0; i < parameters.length; i++) {
            res.push(generateMembershipEvent(`event${i}`, parameters[i]));
        }
        return res;
    };

    // Generate the same sequence of `events` for `n` users, where each user ID
    // is created by replacing the first "$" in userIdTemplate with `i` for
    // `i = 0 .. n`.
    const generateEventsForUsers = (userIdTemplate, n, events) => {
        let eventsForUsers = [];
        let userId = "";
        for (let i = 0; i < n; i++) {
            userId = userIdTemplate.replace('$', i);
            events.forEach((e) => {
                e.userId = userId;
            });
            eventsForUsers = eventsForUsers.concat(generateEvents(events));
        }
        return eventsForUsers;
    };

    beforeEach(function() {
        testUtils.stubClient();
    });

    it('renders expanded events if there are less than props.threshold', function() {
        const events = generateEvents([
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
        ]);
        const props = {
            events: events,
            children: generateTiles(events),
            summaryLength: 1,
            avatarsMaxLength: 5,
            threshold: 3,
        };

        const renderer = new ShallowRenderer();
        renderer.render(<MemberEventListSummary {...props} />);
        const wrapper = renderer.getRenderOutput(); // matrix cli context wrapper
        const result = wrapper.props.children;

        expect(result.props.children).toEqual([
          <div className="event_tile" key="event0">Expanded membership</div>,
        ]);
    });

    it('renders expanded events if there are less than props.threshold', function() {
        const events = generateEvents([
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
        ]);
        const props = {
            events: events,
            children: generateTiles(events),
            summaryLength: 1,
            avatarsMaxLength: 5,
            threshold: 3,
        };

        const renderer = new ShallowRenderer();
        renderer.render(<MemberEventListSummary {...props} />);
        const wrapper = renderer.getRenderOutput(); // matrix cli context wrapper
        const result = wrapper.props.children;

        expect(result.props.children).toEqual([
          <div className="event_tile" key="event0">Expanded membership</div>,
          <div className="event_tile" key="event1">Expanded membership</div>,
        ]);
    });

    it('renders collapsed events if events.length = props.threshold', function() {
        const events = generateEvents([
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
        ]);
        const props = {
            events: events,
            children: generateTiles(events),
            summaryLength: 1,
            avatarsMaxLength: 5,
            threshold: 3,
        };

        const instance = ReactTestUtils.renderIntoDocument(
            <MemberEventListSummary {...props} />,
        );
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(
            instance, "mx_EventListSummary_summary",
        );
        const summaryText = summary.textContent;

        expect(summaryText).toBe("user_1 joined and left and joined");
    });

    it('truncates long join,leave repetitions', function() {
        const events = generateEvents([
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
        ]);
        const props = {
            events: events,
            children: generateTiles(events),
            summaryLength: 1,
            avatarsMaxLength: 5,
            threshold: 3,
        };

        const instance = ReactTestUtils.renderIntoDocument(
            <MemberEventListSummary {...props} />,
        );
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(
            instance, "mx_EventListSummary_summary",
        );
        const summaryText = summary.textContent;

        expect(summaryText).toBe("user_1 joined and left 7 times");
    });

    it('truncates long join,leave repetitions between other events', function() {
        const events = generateEvents([
            {
                userId: "@user_1:some.domain",
                prevMembership: "ban",
                membership: "leave",
                senderId: "@some_other_user:some.domain",
            },
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {
                userId: "@user_1:some.domain",
                prevMembership: "leave",
                membership: "invite",
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

        const instance = ReactTestUtils.renderIntoDocument(
            <MemberEventListSummary {...props} />,
        );
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(
            instance, "mx_EventListSummary_summary",
        );
        const summaryText = summary.textContent;

        expect(summaryText).toBe(
            "user_1 was unbanned, joined and left 7 times and was invited",
        );
    });

    it('truncates multiple sequences of repetitions with other events between',
    function() {
        const events = generateEvents([
            {
                userId: "@user_1:some.domain",
                prevMembership: "ban",
                membership: "leave",
                senderId: "@some_other_user:some.domain",
            },
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {
                userId: "@user_1:some.domain",
                prevMembership: "leave",
                membership: "ban",
                senderId: "@some_other_user:some.domain",
            },
            {userId: "@user_1:some.domain", prevMembership: "ban", membership: "join"},
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {
                userId: "@user_1:some.domain",
                prevMembership: "leave",
                membership: "invite",
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

        const instance = ReactTestUtils.renderIntoDocument(
            <MemberEventListSummary {...props} />,
        );
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(
            instance, "mx_EventListSummary_summary",
        );
        const summaryText = summary.textContent;

        expect(summaryText).toBe(
            "user_1 was unbanned, joined and left 2 times, was banned, " +
            "joined and left 3 times and was invited",
        );
    });

    it('handles multiple users following the same sequence of memberships', function() {
        const events = generateEvents([
            // user_1
            {
                userId: "@user_1:some.domain",
                prevMembership: "ban",
                membership: "leave",
                senderId: "@some_other_user:some.domain",
            },
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {
                userId: "@user_1:some.domain",
                prevMembership: "leave",
                membership: "ban",
                senderId: "@some_other_user:some.domain",
            },
            // user_2
            {
                userId: "@user_2:some.domain",
                prevMembership: "ban",
                membership: "leave",
                senderId: "@some_other_user:some.domain",
            },
            {userId: "@user_2:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_2:some.domain", prevMembership: "join", membership: "leave"},
            {userId: "@user_2:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_2:some.domain", prevMembership: "join", membership: "leave"},
            {
                userId: "@user_2:some.domain",
                prevMembership: "leave",
                membership: "ban",
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

        const instance = ReactTestUtils.renderIntoDocument(
            <MemberEventListSummary {...props} />,
        );
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(
            instance, "mx_EventListSummary_summary",
        );
        const summaryText = summary.textContent;

        expect(summaryText).toBe(
            "user_1 and one other were unbanned, joined and left 2 times and were banned",
        );
    });

    it('handles many users following the same sequence of memberships', function() {
        const events = generateEventsForUsers("@user_$:some.domain", 20, [
            {
                prevMembership: "ban",
                membership: "leave",
                senderId: "@some_other_user:some.domain",
            },
            {prevMembership: "leave", membership: "join"},
            {prevMembership: "join", membership: "leave"},
            {prevMembership: "leave", membership: "join"},
            {prevMembership: "join", membership: "leave"},
            {
                prevMembership: "leave",
                membership: "ban",
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

        const instance = ReactTestUtils.renderIntoDocument(
            <MemberEventListSummary {...props} />,
        );
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(
            instance, "mx_EventListSummary_summary",
        );
        const summaryText = summary.textContent;

        expect(summaryText).toBe(
            "user_0 and 19 others were unbanned, joined and left 2 times and were banned",
        );
    });

    it('correctly orders sequences of transitions by the order of their first event',
    function() {
        const events = generateEvents([
            {
                userId: "@user_2:some.domain",
                prevMembership: "ban",
                membership: "leave",
                senderId: "@some_other_user:some.domain",
            },
            {
                userId: "@user_1:some.domain",
                prevMembership: "ban",
                membership: "leave",
                senderId: "@some_other_user:some.domain",
            },
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId: "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {
                userId: "@user_1:some.domain",
                prevMembership: "leave",
                membership: "ban",
                senderId: "@some_other_user:some.domain",
            },
            {userId: "@user_2:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_2:some.domain", prevMembership: "join", membership: "leave"},
            {userId: "@user_2:some.domain", prevMembership: "leave", membership: "join"},
            {userId: "@user_2:some.domain", prevMembership: "join", membership: "leave"},
        ]);
        const props = {
            events: events,
            children: generateTiles(events),
            summaryLength: 1,
            avatarsMaxLength: 5,
            threshold: 3,
        };

        const instance = ReactTestUtils.renderIntoDocument(
            <MemberEventListSummary {...props} />,
        );
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(
            instance, "mx_EventListSummary_summary",
        );
        const summaryText = summary.textContent;

        expect(summaryText).toBe(
            "user_2 was unbanned and joined and left 2 times, user_1 was unbanned, " +
            "joined and left 2 times and was banned",
        );
    });

    it('correctly identifies transitions', function() {
        const events = generateEvents([
            // invited
            {userId: "@user_1:some.domain", membership: "invite"},
            // banned
            {userId: "@user_1:some.domain", membership: "ban"},
            // joined
            {userId: "@user_1:some.domain", membership: "join"},
            // invite_reject
            {
                userId: "@user_1:some.domain",
                prevMembership: "invite",
                membership: "leave",
            },
            // left
            {userId: "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            // invite_withdrawal
            {
                userId: "@user_1:some.domain",
                prevMembership: "invite",
                membership: "leave",
                senderId: "@some_other_user:some.domain",
            },
            // unbanned
            {
                userId: "@user_1:some.domain",
                prevMembership: "ban",
                membership: "leave",
                senderId: "@some_other_user:some.domain",
            },
            // kicked
            {
                userId: "@user_1:some.domain",
                prevMembership: "join",
                membership: "leave",
                senderId: "@some_other_user:some.domain",
            },
            // default for sender=target (leave)
            {
                userId: "@user_1:some.domain",
                prevMembership: "????",
                membership: "leave",
                senderId: "@user_1:some.domain",
            },
            // default for sender<>target (kicked)
            {
                userId: "@user_1:some.domain",
                prevMembership: "????",
                membership: "leave",
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

        const instance = ReactTestUtils.renderIntoDocument(
            <MemberEventListSummary {...props} />,
        );
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(
            instance, "mx_EventListSummary_summary",
        );
        const summaryText = summary.textContent;

        expect(summaryText).toBe(
            "user_1 was invited, was banned, joined, rejected their invitation, left, " +
            "had their invitation withdrawn, was unbanned, was kicked, left and was kicked",
        );
    });

    it('handles invitation plurals correctly when there are multiple users', function() {
        const events = generateEvents([
            {
                userId: "@user_1:some.domain",
                prevMembership: "invite",
                membership: "leave",
            },
            {
                userId: "@user_1:some.domain",
                prevMembership: "invite",
                membership: "leave",
                senderId: "@some_other_user:some.domain",
            },
            {
                userId: "@user_2:some.domain",
                prevMembership: "invite",
                membership: "leave",
            },
            {
                userId: "@user_2:some.domain",
                prevMembership: "invite",
                membership: "leave",
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

        const instance = ReactTestUtils.renderIntoDocument(
            <MemberEventListSummary {...props} />,
        );
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(
            instance, "mx_EventListSummary_summary",
        );
        const summaryText = summary.textContent;

        expect(summaryText).toBe(
            "user_1 and one other rejected their invitations and " +
            "had their invitations withdrawn",
        );
    });

    it('handles invitation plurals correctly when there are multiple invites',
    function() {
        const events = generateEvents([
            {
                userId: "@user_1:some.domain",
                prevMembership: "invite",
                membership: "leave",
            },
            {
                userId: "@user_1:some.domain",
                prevMembership: "invite",
                membership: "leave",
            },
        ]);
        const props = {
            events: events,
            children: generateTiles(events),
            summaryLength: 1,
            avatarsMaxLength: 5,
            threshold: 1, // threshold = 1 to force collapse
        };

        const instance = ReactTestUtils.renderIntoDocument(
            <MemberEventListSummary {...props} />,
        );
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(
            instance, "mx_EventListSummary_summary",
        );
        const summaryText = summary.textContent;

        expect(summaryText).toBe(
            "user_1 rejected their invitation 2 times",
        );
    });

    it('handles a summary length = 2, with no "others"', function() {
        const events = generateEvents([
            {userId: "@user_1:some.domain", membership: "join"},
            {userId: "@user_1:some.domain", membership: "join"},
            {userId: "@user_2:some.domain", membership: "join"},
            {userId: "@user_2:some.domain", membership: "join"},
        ]);
        const props = {
            events: events,
            children: generateTiles(events),
            summaryLength: 2,
            avatarsMaxLength: 5,
            threshold: 3,
        };

        const instance = ReactTestUtils.renderIntoDocument(
            <MemberEventListSummary {...props} />,
        );
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(
            instance, "mx_EventListSummary_summary",
        );
        const summaryText = summary.textContent;

        expect(summaryText).toBe(
            "user_1 and user_2 joined 2 times",
        );
    });

    it('handles a summary length = 2, with 1 "other"', function() {
        const events = generateEvents([
            {userId: "@user_1:some.domain", membership: "join"},
            {userId: "@user_2:some.domain", membership: "join"},
            {userId: "@user_3:some.domain", membership: "join"},
        ]);
        const props = {
            events: events,
            children: generateTiles(events),
            summaryLength: 2,
            avatarsMaxLength: 5,
            threshold: 3,
        };

        const instance = ReactTestUtils.renderIntoDocument(
            <MemberEventListSummary {...props} />,
        );
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(
            instance, "mx_EventListSummary_summary",
        );
        const summaryText = summary.textContent;

        expect(summaryText).toBe(
            "user_1, user_2 and one other joined",
        );
    });

    it('handles a summary length = 2, with many "others"', function() {
        const events = generateEventsForUsers("@user_$:some.domain", 20, [
            {membership: "join"},
        ]);
        const props = {
            events: events,
            children: generateTiles(events),
            summaryLength: 2,
            avatarsMaxLength: 5,
            threshold: 3,
        };

        const instance = ReactTestUtils.renderIntoDocument(
            <MemberEventListSummary {...props} />,
        );
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(
            instance, "mx_EventListSummary_summary",
        );
        const summaryText = summary.textContent;

        expect(summaryText).toBe(
            "user_0, user_1 and 18 others joined",
        );
    });
});
