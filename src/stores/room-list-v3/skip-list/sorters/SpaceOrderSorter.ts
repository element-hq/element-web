/*
Made for Blackjack Element

Based on AlphabeticSorter
*/

import type { Room } from "matrix-js-sdk/src/matrix";
import { type Sorter, SortingAlgorithm } from ".";

function getTopicNum(room: Room): number | undefined {
    // Gets the number in square brackets at the start of the room's topic
    // Like if the topic is "[5] - General chat for general discussions." this method will return 5
    // It can also return negative and decimal values

    const topic = room.currentState.getStateEvents("m.room.topic", "")?.getContent()?.topic;
    if (typeof topic !== "string") return undefined;

    const match = topic.match(/^\[(-?\d+(?:\.\d+)?)\]/);
    if (!match) return undefined;

    return parseFloat(match[1]);
}

export class SpaceOrderSorter implements Sorter {
    private readonly collator = new Intl.Collator();

    public sort(rooms: Room[]): Room[] {
        return [...rooms].sort((a, b) => {
            return this.comparator(a, b);
        });
    }

    public comparator(roomA: Room, roomB: Room): number {
        const topicNumA = getTopicNum(roomA);
        const topicNumB = getTopicNum(roomB);

        if(topicNumA==topicNumB){
            return this.collator.compare(roomA.name, roomB.name);
        }
        if (topicNumA !== undefined && topicNumB == undefined) return -1;
        if (topicNumB !== undefined && topicNumA == undefined) return 1;
        if(topicNumA>topicNumB){
            return 1;
        }
        return -1;
    }

    public get type(): SortingAlgorithm.SpaceOrder {
        return SortingAlgorithm.SpaceOrder;
    }
}
