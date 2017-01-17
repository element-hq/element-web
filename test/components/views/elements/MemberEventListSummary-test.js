const expect = require('expect');
const React = require('react');
const ReactDOM = require("react-dom");
const ReactTestUtils = require('react-addons-test-utils');
const sdk = require('matrix-react-sdk');
const MemberEventListSummary = sdk.getComponent('views.elements.MemberEventListSummary');

const testUtils = require('../../../test-utils');
describe.only('MemberEventListSummary', function() {
    let sandbox;
    let parentDiv;

    const generateTiles = (events) => {
        return events.map((e) => {
            return (
                <div key={e.getId()} className="event_tile">
                    Expanded membership
                </div>
            );
        });
    };

    const generateMembershipEvent = (eventId, parameters) => {
        let membership = parameters.membership;
        let userId = parameters.userId;
        let prevMembership = parameters.prevMembership;
        let senderId = parameters.senderId;
        return {
            content: {
                membership: membership,
            },
            target: {
                name: userId.match(/@([^:]*):/)[1],
                getAvatarUrl: () => {
                    return "avatar.jpeg";
                },
                userId: userId,
            },
            getId: () => {
                return eventId;
            },
            getContent: function() {
                return this.content;
            },
            getPrevContent: function() {
                return {
                    membership: prevMembership ? prevMembership : this.content,
                };
            },
            getSender: () => {
                return senderId || userId;
            },
            getStateKey: () => {
                return userId;
            },
        };
    };

    const generateEvents = (parameters) => {
        const res = [];
        for (let i = 0; i < parameters.length; i++) {
            res.push(generateMembershipEvent(`event${i}`, parameters[i]));
        }
        return res;
    };

    const generateEventsForUsers = (userIdTemplate, n, events) => {
        let eventsForUsers = [];
        let userId = "";
        for (let i = 0; i < n; i++) {
            userId = userIdTemplate.replace('$', i);
            events.forEach((e) => {
                e.userId = userId;
                return e;
            });
            eventsForUsers = eventsForUsers.concat(generateEvents(events));
        }
        return eventsForUsers;
    };

    beforeEach(function() {
        testUtils.beforeEach(this);
        sandbox = testUtils.stubClient();
        parentDiv = document.createElement('div');
        document.body.appendChild(parentDiv);
    });

    afterEach(function() {
        sandbox.restore();
    });

    it('renders expanded events if there are less than props.threshold', function(done) {
        const events = generateEvents([
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
        ]);
        const props = {
            events : events,
            children : generateTiles(events),
            summaryLength : 1,
            avatarsMaxLength : 5,
            threshold : 3,
        };

        const renderer = ReactTestUtils.createRenderer();
        renderer.render(<MemberEventListSummary {...props} />);
        const result = renderer.getRenderOutput();

        expect(result.type).toBe('div');
        expect(result.props.children).toEqual([
          <div className="event_tile" key="event0">Expanded membership</div>,
        ]);
        done();
    });

    it('renders expanded events if there are less than props.threshold', function(done) {
        const events = generateEvents([
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
        ]);
        const props = {
            events : events,
            children : generateTiles(events),
            summaryLength : 1,
            avatarsMaxLength : 5,
            threshold : 3,
        };

        const renderer = ReactTestUtils.createRenderer();
        renderer.render(<MemberEventListSummary {...props} />);
        const result = renderer.getRenderOutput();

        expect(result.type).toBe('div');
        expect(result.props.children).toEqual([
          <div className="event_tile" key="event0">Expanded membership</div>,
          <div className="event_tile" key="event1">Expanded membership</div>,
        ]);
        done();
    });

    it('renders collapsed events if events.length = props.threshold', function(done) {
        const events = generateEvents([
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
        ]);
        const props = {
            events : events,
            children : generateTiles(events),
            summaryLength : 1,
            avatarsMaxLength : 5,
            threshold : 3,
        };

        const instance = ReactDOM.render(<MemberEventListSummary {...props} />, parentDiv);
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(instance, "mx_MemberEventListSummary_summary");
        const summaryText = summary.innerText;

        expect(summaryText).toBe("user_1 joined and left and joined");

        done();
    });

    it('truncates long join,leave repetitions', function(done) {
        const events = generateEvents([
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
        ]);
        const props = {
            events : events,
            children : generateTiles(events),
            summaryLength : 1,
            avatarsMaxLength : 5,
            threshold : 3,
        };

        const instance = ReactDOM.render(<MemberEventListSummary {...props} />, parentDiv);
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(instance, "mx_MemberEventListSummary_summary");
        const summaryText = summary.innerText;

        expect(summaryText).toBe("user_1 joined and left 7 times");

        done();
    });

    it('truncates long join,leave repetitions inbetween other events', function(done) {
        const events = generateEvents([
            {userId : "@user_1:some.domain", prevMembership: "ban", membership: "leave", senderId: "@some_other_user:some.domain"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "invite", senderId: "@some_other_user:some.domain"},
        ]);
        const props = {
            events : events,
            children : generateTiles(events),
            summaryLength : 1,
            avatarsMaxLength : 5,
            threshold : 3,
        };

        const instance = ReactDOM.render(<MemberEventListSummary {...props} />, parentDiv);
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(instance, "mx_MemberEventListSummary_summary");
        const summaryText = summary.innerText;

        expect(summaryText).toBe("user_1 was unbanned, joined and left 7 times and was invited");

        done();
    });

    it('truncates multiple sequences of repetitions with other events inbetween', function(done) {
        const events = generateEvents([
            {userId : "@user_1:some.domain", prevMembership: "ban", membership: "leave", senderId: "@some_other_user:some.domain"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "ban", senderId: "@some_other_user:some.domain"},
            {userId : "@user_1:some.domain", prevMembership: "ban", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "invite", senderId: "@some_other_user:some.domain"},
        ]);
        const props = {
            events : events,
            children : generateTiles(events),
            summaryLength : 1,
            avatarsMaxLength : 5,
            threshold : 3,
        };

        const instance = ReactDOM.render(<MemberEventListSummary {...props} />, parentDiv);
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(instance, "mx_MemberEventListSummary_summary");
        const summaryText = summary.innerText;

        expect(summaryText).toBe("user_1 was unbanned, joined and left 2 times, was banned, joined and left 3 times and was invited");

        done();
    });

    it('handles multple users following the same sequence of memberships', function(done) {
        const events = generateEvents([
            // user_1
            {userId : "@user_1:some.domain", prevMembership: "ban", membership: "leave", senderId: "@some_other_user:some.domain"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "ban", senderId: "@some_other_user:some.domain"},
            // user_2
            {userId : "@user_2:some.domain", prevMembership: "ban", membership: "leave", senderId: "@some_other_user:some.domain"},
            {userId : "@user_2:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_2:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_2:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_2:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_2:some.domain", prevMembership: "leave", membership: "ban", senderId: "@some_other_user:some.domain"},
        ]);
        const props = {
            events : events,
            children : generateTiles(events),
            summaryLength : 1,
            avatarsMaxLength : 5,
            threshold : 3,
        };

        const instance = ReactDOM.render(<MemberEventListSummary {...props} />, parentDiv);
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(instance, "mx_MemberEventListSummary_summary");
        const summaryText = summary.innerText;

        expect(summaryText).toBe("user_1 and 1 other were unbanned, joined and left 2 times and were banned");

        done();
    });

    it('handles multple users following the same sequence of memberships', function(done) {
        const events = generateEvents([
            // user_1
            {userId : "@user_1:some.domain", prevMembership: "ban", membership: "leave", senderId: "@some_other_user:some.domain"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "ban", senderId: "@some_other_user:some.domain"},
            // user_2
            {userId : "@user_2:some.domain", prevMembership: "ban", membership: "leave", senderId: "@some_other_user:some.domain"},
            {userId : "@user_2:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_2:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_2:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_2:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_2:some.domain", prevMembership: "leave", membership: "ban", senderId: "@some_other_user:some.domain"},
        ]);
        const props = {
            events : events,
            children : generateTiles(events),
            summaryLength : 1,
            avatarsMaxLength : 5,
            threshold : 3,
        };

        const instance = ReactDOM.render(<MemberEventListSummary {...props} />, parentDiv);
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(instance, "mx_MemberEventListSummary_summary");
        const summaryText = summary.innerText;

        expect(summaryText).toBe("user_1 and 1 other were unbanned, joined and left 2 times and were banned");

        done();
    });

    it('handles many users following the same sequence of memberships', function(done) {
        const events = generateEventsForUsers("@user_$:some.domain", 20, [
            {prevMembership: "ban", membership: "leave", senderId: "@some_other_user:some.domain"},
            {prevMembership: "leave", membership: "join"},
            {prevMembership: "join", membership: "leave"},
            {prevMembership: "leave", membership: "join"},
            {prevMembership: "join", membership: "leave"},
            {prevMembership: "leave", membership: "ban", senderId: "@some_other_user:some.domain"},
        ]);
        const props = {
            events : events,
            children : generateTiles(events),
            summaryLength : 1,
            avatarsMaxLength : 5,
            threshold : 3,
        };

        const instance = ReactDOM.render(<MemberEventListSummary {...props} />, parentDiv);
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(instance, "mx_MemberEventListSummary_summary");
        const summaryText = summary.innerText;

        expect(summaryText).toBe("user_0 and 19 others were unbanned, joined and left 2 times and were banned");

        done();
    });

    it('correctly orders sequences of transitions by the order of their first event', function(done) {
        const events = generateEvents([
            {userId : "@user_2:some.domain", prevMembership: "ban", membership: "leave", senderId: "@some_other_user:some.domain"},
            {userId : "@user_1:some.domain", prevMembership: "ban", membership: "leave", senderId: "@some_other_user:some.domain"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "leave", membership: "ban", senderId: "@some_other_user:some.domain"},
            {userId : "@user_2:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_2:some.domain", prevMembership: "join", membership: "leave"},
            {userId : "@user_2:some.domain", prevMembership: "leave", membership: "join"},
            {userId : "@user_2:some.domain", prevMembership: "join", membership: "leave"},
        ]);
        const props = {
            events : events,
            children : generateTiles(events),
            summaryLength : 1,
            avatarsMaxLength : 5,
            threshold : 3,
        };

        const instance = ReactDOM.render(<MemberEventListSummary {...props} />, parentDiv);
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(instance, "mx_MemberEventListSummary_summary");
        const summaryText = summary.innerText;

        expect(summaryText).toBe(
            "user_2 was unbanned and joined and left 2 times, user_1 was unbanned, joined and left 2 times and was banned"
        );

        done();
    });

    it('correctly identifies transitions', function(done) {
        const events = generateEvents([
            // invited
            {userId : "@user_1:some.domain", membership: "invite"},
            // banned
            {userId : "@user_1:some.domain", membership: "ban"},
            // joined
            {userId : "@user_1:some.domain", membership: "join"},
            // invite_reject
            {userId : "@user_1:some.domain", prevMembership: "invite", membership: "leave"},
            // left
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave"},
            // invite_withdrawal
            {userId : "@user_1:some.domain", prevMembership: "invite", membership: "leave", senderId: "@some_other_user:some.domain"},
            // unbanned
            {userId : "@user_1:some.domain", prevMembership: "ban", membership: "leave", senderId: "@some_other_user:some.domain"},
            // kicked
            {userId : "@user_1:some.domain", prevMembership: "join", membership: "leave", senderId: "@some_other_user:some.domain"},
            // default = left
            {userId : "@user_1:some.domain", prevMembership: "????", membership: "leave", senderId: "@some_other_user:some.domain"},
        ]);
        const props = {
            events : events,
            children : generateTiles(events),
            summaryLength : 1,
            avatarsMaxLength : 5,
            threshold : 3,
        };

        const instance = ReactDOM.render(<MemberEventListSummary {...props} />, parentDiv);
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(instance, "mx_MemberEventListSummary_summary");
        const summaryText = summary.innerText;

        expect(summaryText).toBe(
            "user_1 was invited, was banned, joined, rejected their invitation, left, had their invitation withdrawn, was unbanned, was kicked and left"
        );

        done();
    });

    it('handles invitation plurals correctly when there are multiple users', function(done) {
        const events = generateEvents([
            {userId : "@user_1:some.domain", prevMembership: "invite", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "invite", membership: "leave", senderId: "@some_other_user:some.domain"},
            {userId : "@user_2:some.domain", prevMembership: "invite", membership: "leave"},
            {userId : "@user_2:some.domain", prevMembership: "invite", membership: "leave", senderId: "@some_other_user:some.domain"},
        ]);
        const props = {
            events : events,
            children : generateTiles(events),
            summaryLength : 1,
            avatarsMaxLength : 5,
            threshold : 3,
        };

        const instance = ReactDOM.render(<MemberEventListSummary {...props} />, parentDiv);
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(instance, "mx_MemberEventListSummary_summary");
        const summaryText = summary.innerText;

        expect(summaryText).toBe(
            "user_1 and 1 other rejected their invitations and had their invitations withdrawn"
        );

        done();
    });

    it('handles invitation plurals correctly when there are multiple invites', function(done) {
        const events = generateEvents([
            {userId : "@user_1:some.domain", prevMembership: "invite", membership: "leave"},
            {userId : "@user_1:some.domain", prevMembership: "invite", membership: "leave"},
        ]);
        const props = {
            events : events,
            children : generateTiles(events),
            summaryLength : 1,
            avatarsMaxLength : 5,
            threshold : 1, // threshold = 1 to force collapse
        };

        const instance = ReactDOM.render(<MemberEventListSummary {...props} />, parentDiv);
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(instance, "mx_MemberEventListSummary_summary");
        const summaryText = summary.innerText;

        expect(summaryText).toBe(
            "user_1 rejected their invitations 2 times"
        );

        done();
    });

    it('handles a summary length = 2, with no "others"', function(done) {
        const events = generateEvents([
            {userId : "@user_1:some.domain", membership: "join"},
            {userId : "@user_1:some.domain", membership: "join"},
            {userId : "@user_2:some.domain", membership: "join"},
            {userId : "@user_2:some.domain", membership: "join"},
        ]);
        const props = {
            events : events,
            children : generateTiles(events),
            summaryLength : 2,
            avatarsMaxLength : 5,
            threshold : 3,
        };

        const instance = ReactDOM.render(<MemberEventListSummary {...props} />, parentDiv);
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(instance, "mx_MemberEventListSummary_summary");
        const summaryText = summary.innerText;

        expect(summaryText).toBe(
            "user_1 and user_2 joined 2 times"
        );

        done();
    });

    it('handles a summary length = 2, with 1 "other"', function(done) {
        const events = generateEvents([
            {userId : "@user_1:some.domain", membership: "join"},
            {userId : "@user_2:some.domain", membership: "join"},
            {userId : "@user_3:some.domain", membership: "join"},
        ]);
        const props = {
            events : events,
            children : generateTiles(events),
            summaryLength : 2,
            avatarsMaxLength : 5,
            threshold : 3,
        };

        const instance = ReactDOM.render(<MemberEventListSummary {...props} />, parentDiv);
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(instance, "mx_MemberEventListSummary_summary");
        const summaryText = summary.innerText;

        expect(summaryText).toBe(
            "user_1, user_2 and 1 other joined"
        );

        done();
    });

    it('handles a summary length = 2, with many "others"', function(done) {
        const events = generateEventsForUsers("@user_$:some.domain", 20, [
            {membership: "join"},
        ]);
        const props = {
            events : events,
            children : generateTiles(events),
            summaryLength : 2,
            avatarsMaxLength : 5,
            threshold : 3,
        };

        const instance = ReactDOM.render(<MemberEventListSummary {...props} />, parentDiv);
        const summary = ReactTestUtils.findRenderedDOMComponentWithClass(instance, "mx_MemberEventListSummary_summary");
        const summaryText = summary.innerText;

        expect(summaryText).toBe(
            "user_0, user_1 and 18 others joined"
        );

        done();
    });
});