/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { EventTimelineSet } from "../../src/models/event-timeline-set";
import { MatrixEvent } from "../../src/models/event";
import { Room } from "../../src/models/room";
import { Relations } from "../../src/models/relations";

describe("Relations", function() {
    it("should deduplicate annotations", function() {
        const room = new Room("room123", null, null);
        const relations = new Relations("m.annotation", "m.reaction", room);

        // Create an instance of an annotation
        const eventData = {
            "sender": "@bob:example.com",
            "type": "m.reaction",
            "event_id": "$cZ1biX33ENJqIm00ks0W_hgiO_6CHrsAc3ZQrnLeNTw",
            "room_id": "!pzVjCQSoQPpXQeHpmK:example.com",
            "content": {
                "m.relates_to": {
                    "event_id": "$2s4yYpEkVQrPglSCSqB_m6E8vDhWsg0yFNyOJdVIb_o",
                    "key": "👍️",
                    "rel_type": "m.annotation",
                },
            },
        };
        const eventA = new MatrixEvent(eventData);

        // Add the event once and check results
        {
            relations.addEvent(eventA);
            const annotationsByKey = relations.getSortedAnnotationsByKey();
            expect(annotationsByKey.length).toEqual(1);
            const [key, events] = annotationsByKey[0];
            expect(key).toEqual("👍️");
            expect(events.size).toEqual(1);
        }

        // Add the event again and expect the same
        {
            relations.addEvent(eventA);
            const annotationsByKey = relations.getSortedAnnotationsByKey();
            expect(annotationsByKey.length).toEqual(1);
            const [key, events] = annotationsByKey[0];
            expect(key).toEqual("👍️");
            expect(events.size).toEqual(1);
        }

        // Create a fresh object with the same event content
        const eventB = new MatrixEvent(eventData);

        // Add the event again and expect the same
        {
            relations.addEvent(eventB);
            const annotationsByKey = relations.getSortedAnnotationsByKey();
            expect(annotationsByKey.length).toEqual(1);
            const [key, events] = annotationsByKey[0];
            expect(key).toEqual("👍️");
            expect(events.size).toEqual(1);
        }
    });

    it("should emit created regardless of ordering", async function() {
        const targetEvent = new MatrixEvent({
            "sender": "@bob:example.com",
            "type": "m.room.message",
            "event_id": "$2s4yYpEkVQrPglSCSqB_m6E8vDhWsg0yFNyOJdVIb_o",
            "room_id": "!pzVjCQSoQPpXQeHpmK:example.com",
            "content": {},
        });
        const relationEvent = new MatrixEvent({
            "sender": "@bob:example.com",
            "type": "m.reaction",
            "event_id": "$cZ1biX33ENJqIm00ks0W_hgiO_6CHrsAc3ZQrnLeNTw",
            "room_id": "!pzVjCQSoQPpXQeHpmK:example.com",
            "content": {
                "m.relates_to": {
                    "event_id": "$2s4yYpEkVQrPglSCSqB_m6E8vDhWsg0yFNyOJdVIb_o",
                    "key": "👍️",
                    "rel_type": "m.annotation",
                },
            },
        });

        // Stub the room

        const room = new Room("room123", null, null);

        // Add the target event first, then the relation event
        {
            const relationsCreated = new Promise(resolve => {
                targetEvent.once("Event.relationsCreated", resolve);
            });

            const timelineSet = new EventTimelineSet(room, {
                unstableClientRelationAggregation: true,
            });
            timelineSet.addLiveEvent(targetEvent);
            timelineSet.addLiveEvent(relationEvent);

            await relationsCreated;
        }

        // Add the relation event first, then the target event
        {
            const relationsCreated = new Promise(resolve => {
                targetEvent.once("Event.relationsCreated", resolve);
            });

            const timelineSet = new EventTimelineSet(room, {
                unstableClientRelationAggregation: true,
            });
            timelineSet.addLiveEvent(relationEvent);
            timelineSet.addLiveEvent(targetEvent);

            await relationsCreated;
        }
    });
});
