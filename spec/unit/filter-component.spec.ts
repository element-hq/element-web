import { RelationType } from "../../src";
import { FilterComponent } from "../../src/filter-component";
import { mkEvent } from "../test-utils/test-utils";

describe("Filter Component", function () {
    describe("types", function () {
        it("should filter out events with other types", function () {
            const filter = new FilterComponent({ types: ["m.room.message"] });
            const event = mkEvent({
                type: "m.room.member",
                content: {},
                room: "roomId",
                event: true,
            });

            const checkResult = filter.check(event);

            expect(checkResult).toBe(false);
        });

        it("should validate events with the same type", function () {
            const filter = new FilterComponent({ types: ["m.room.message"] });
            const event = mkEvent({
                type: "m.room.message",
                content: {},
                room: "roomId",
                event: true,
            });

            const checkResult = filter.check(event);

            expect(checkResult).toBe(true);
        });

        it("should filter out events by relation participation", function () {
            const currentUserId = "@me:server.org";
            const filter = new FilterComponent(
                {
                    related_by_senders: [currentUserId],
                },
                currentUserId,
            );

            const threadRootNotParticipated = mkEvent({
                type: "m.room.message",
                content: {},
                room: "roomId",
                user: "@someone-else:server.org",
                event: true,
                unsigned: {
                    "m.relations": {
                        "m.thread": {
                            count: 2,
                            current_user_participated: false,
                        },
                    },
                },
            });

            expect(filter.check(threadRootNotParticipated)).toBe(false);
        });

        it("should keep events by relation participation", function () {
            const currentUserId = "@me:server.org";
            const filter = new FilterComponent(
                {
                    related_by_senders: [currentUserId],
                },
                currentUserId,
            );

            const threadRootParticipated = mkEvent({
                type: "m.room.message",
                content: {},
                unsigned: {
                    "m.relations": {
                        "m.thread": {
                            count: 2,
                            current_user_participated: true,
                        },
                    },
                },
                user: "@someone-else:server.org",
                room: "roomId",
                event: true,
            });

            expect(filter.check(threadRootParticipated)).toBe(true);
        });

        it("should filter out events by relation type", function () {
            const filter = new FilterComponent({
                related_by_rel_types: ["m.thread"],
            });

            const referenceRelationEvent = mkEvent({
                type: "m.room.message",
                content: {},
                room: "roomId",
                event: true,
                unsigned: {
                    "m.relations": {
                        [RelationType.Reference]: {},
                    },
                },
            });

            expect(filter.check(referenceRelationEvent)).toBe(false);
        });

        it("should keep events by relation type", function () {
            const filter = new FilterComponent({
                related_by_rel_types: ["m.thread"],
            });

            const threadRootEvent = mkEvent({
                type: "m.room.message",
                content: {},
                unsigned: {
                    "m.relations": {
                        "m.thread": {
                            count: 2,
                            current_user_participated: true,
                        },
                    },
                },
                room: "roomId",
                event: true,
            });

            const eventWithMultipleRelations = mkEvent({
                type: "m.room.message",
                content: {},
                unsigned: {
                    "m.relations": {
                        "testtesttest": {},
                        "m.annotation": {
                            chunk: [
                                {
                                    type: "m.reaction",
                                    key: "🤫",
                                    count: 1,
                                },
                            ],
                        },
                        "m.thread": {
                            count: 2,
                            current_user_participated: true,
                        },
                    },
                },
                room: "roomId",
                event: true,
            });

            const noMatchEvent = mkEvent({
                type: "m.room.message",
                content: {},
                unsigned: {
                    "m.relations": {
                        testtesttest: {},
                    },
                },
                room: "roomId",
                event: true,
            });

            expect(filter.check(threadRootEvent)).toBe(true);
            expect(filter.check(eventWithMultipleRelations)).toBe(true);
            expect(filter.check(noMatchEvent)).toBe(false);
        });
    });
});
