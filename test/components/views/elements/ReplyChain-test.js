import "../../../skinned-sdk";
import * as testUtils from '../../../test-utils';
import ReplyChain from '../../../../src/components/views/elements/ReplyChain';

describe("ReplyChain", () => {
    describe('getParentEventId', () => {
        it('retrieves relation reply from unedited event', () => {
            const originalEventWithRelation = testUtils.mkEvent({
                event: true,
                type: "m.room.message",
                content: {
                    "msgtype": "m.text",
                    "body": "> Reply to this message\n\n foo",
                    "m.relates_to": {
                        "m.in_reply_to": {
                            "event_id": "$qkjmFBTEc0VvfVyzq1CJuh1QZi_xDIgNEFjZ4Pq34og",
                        },
                    },
                },
                user: "some_other_user",
                room: "room_id",
            });

            expect(ReplyChain.getParentEventId(originalEventWithRelation))
                .toStrictEqual('$qkjmFBTEc0VvfVyzq1CJuh1QZi_xDIgNEFjZ4Pq34og');
        });

        it('retrieves relation reply from original event when edited', () => {
            const originalEventWithRelation = testUtils.mkEvent({
                event: true,
                type: "m.room.message",
                content: {
                    "msgtype": "m.text",
                    "body": "> Reply to this message\n\n foo",
                    "m.relates_to": {
                        "m.in_reply_to": {
                            "event_id": "$qkjmFBTEc0VvfVyzq1CJuh1QZi_xDIgNEFjZ4Pq34og",
                        },
                    },
                },
                user: "some_other_user",
                room: "room_id",
            });

            const editEvent = testUtils.mkEvent({
                event: true,
                type: "m.room.message",
                content: {
                    "msgtype": "m.text",
                    "body": "> Reply to this message\n\n * foo bar",
                    "m.new_content": {
                        "msgtype": "m.text",
                        "body": "foo bar",
                    },
                    "m.relates_to": {
                        "rel_type": "m.replace",
                        "event_id": originalEventWithRelation.event_id,
                    },
                },
                user: "some_other_user",
                room: "room_id",
            });

            // The edit replaces the original event
            originalEventWithRelation.makeReplaced(editEvent);

            // The relation should be pulled from the original event
            expect(ReplyChain.getParentEventId(originalEventWithRelation))
                .toStrictEqual('$qkjmFBTEc0VvfVyzq1CJuh1QZi_xDIgNEFjZ4Pq34og');
        });

        it('retrieves relation reply from edit event when provided', () => {
            const originalEvent = testUtils.mkEvent({
                event: true,
                type: "m.room.message",
                content: {
                    msgtype: "m.text",
                    body: "foo",
                },
                user: "some_other_user",
                room: "room_id",
            });

            const editEvent = testUtils.mkEvent({
                event: true,
                type: "m.room.message",
                content: {
                    "msgtype": "m.text",
                    "body": "> Reply to this message\n\n * foo bar",
                    "m.new_content": {
                        "msgtype": "m.text",
                        "body": "foo bar",
                        "m.relates_to": {
                            "m.in_reply_to": {
                                "event_id": "$qkjmFBTEc0VvfVyzq1CJuh1QZi_xDIgNEFjZ4Pq34og",
                            },
                        },
                    },
                    "m.relates_to": {
                        "rel_type": "m.replace",
                        "event_id": originalEvent.event_id,
                    },
                },
                user: "some_other_user",
                room: "room_id",
            });

            // The edit replaces the original event
            originalEvent.makeReplaced(editEvent);

            // The relation should be pulled from the edit event
            expect(ReplyChain.getParentEventId(originalEvent))
                .toStrictEqual('$qkjmFBTEc0VvfVyzq1CJuh1QZi_xDIgNEFjZ4Pq34og');
        });

        it('prefers relation reply from edit event over original event', () => {
            const originalEventWithRelation = testUtils.mkEvent({
                event: true,
                type: "m.room.message",
                content: {
                    "msgtype": "m.text",
                    "body": "> Reply to this message\n\n foo",
                    "m.relates_to": {
                        "m.in_reply_to": {
                            "event_id": "$111",
                        },
                    },
                },
                user: "some_other_user",
                room: "room_id",
            });

            const editEvent = testUtils.mkEvent({
                event: true,
                type: "m.room.message",
                content: {
                    "msgtype": "m.text",
                    "body": "> Reply to this message\n\n * foo bar",
                    "m.new_content": {
                        "msgtype": "m.text",
                        "body": "foo bar",
                        "m.relates_to": {
                            "m.in_reply_to": {
                                "event_id": "$999",
                            },
                        },
                    },
                    "m.relates_to": {
                        "rel_type": "m.replace",
                        "event_id": originalEventWithRelation.event_id,
                    },
                },
                user: "some_other_user",
                room: "room_id",
            });

            // The edit replaces the original event
            originalEventWithRelation.makeReplaced(editEvent);

            // The relation should be pulled from the edit event
            expect(ReplyChain.getParentEventId(originalEventWithRelation)).toStrictEqual('$999');
        });

        it('able to clear relation reply from original event by providing empty relation field', () => {
            const originalEventWithRelation = testUtils.mkEvent({
                event: true,
                type: "m.room.message",
                content: {
                    "msgtype": "m.text",
                    "body": "> Reply to this message\n\n foo",
                    "m.relates_to": {
                        "m.in_reply_to": {
                            "event_id": "$111",
                        },
                    },
                },
                user: "some_other_user",
                room: "room_id",
            });

            const editEvent = testUtils.mkEvent({
                event: true,
                type: "m.room.message",
                content: {
                    "msgtype": "m.text",
                    "body": "> Reply to this message\n\n * foo bar",
                    "m.new_content": {
                        "msgtype": "m.text",
                        "body": "foo bar",
                        // Clear the relation from the original event
                        "m.relates_to": {},
                    },
                    "m.relates_to": {
                        "rel_type": "m.replace",
                        "event_id": originalEventWithRelation.event_id,
                    },
                },
                user: "some_other_user",
                room: "room_id",
            });

            // The edit replaces the original event
            originalEventWithRelation.makeReplaced(editEvent);

            // The relation should be pulled from the edit event
            expect(ReplyChain.getParentEventId(originalEventWithRelation)).toStrictEqual(undefined);
        });
    });
});
