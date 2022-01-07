import { FilterComponent } from "../../src/filter-component";
import { mkEvent } from '../test-utils';

describe("Filter Component", function() {
    describe("types", function() {
        it("should filter out events with other types", function() {
            const filter = new FilterComponent({ types: ['m.room.message'] });
            const event = mkEvent({
                type: 'm.room.member',
                content: { },
                room: 'roomId',
                event: true,
            });

            const checkResult = filter.check(event);

            expect(checkResult).toBe(false);
        });

        it("should validate events with the same type", function() {
            const filter = new FilterComponent({ types: ['m.room.message'] });
            const event = mkEvent({
                type: 'm.room.message',
                content: { },
                room: 'roomId',
                event: true,
            });

            const checkResult = filter.check(event);

            expect(checkResult).toBe(true);
        });
    });
});
