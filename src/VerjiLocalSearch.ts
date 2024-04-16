/*
    Copyright 2024 Verji Tech AS. All rights reserved.
    Unauthorized copying or distribution of this file, via any medium, is strictly prohibited.
*/

import {
    EventTimeline,
    MatrixClient,
    MatrixEvent,
    Room,
    RoomMember,
    SearchResult as ElementSearchResult,
} from "matrix-js-sdk/src/matrix";
import { EventContext } from "matrix-js-sdk/src/models/event-context"; // eslint-disable-line

import { MatrixClientPeg } from "./MatrixClientPeg";

interface WordHighlight {
    word: string;
    highlight: boolean;
}

export interface SearchTerm {
    searchTypeAdvanced: boolean;
    searchTypeNormal: boolean;
    searchExpression?: RegExp | null;
    regExpHighlightMap?: { [key: string]: boolean };
    fullText?: string;
    words: WordHighlight[];
    regExpHighlights: any[];
    isEmptySearch?: boolean;
}

interface Member {
    userId: string;
}

interface MemberObj {
    [key: string]: Member;
}

interface SearchResultItem {
    result: MatrixEvent;
    context: EventContext;
}

interface SearchResult {
    _query: string;
    results: any[];
    highlights: any[];
    count: number;
}

/**
 * Searches all events locally based on the provided search term and room ID.
 *
 * @param {string} term - The search term.
 * @param {string | undefined} roomId - The ID of the room to search in.
 * @returns {Promise<SearchResult>} A promise that resolves to the search result.
 * @throws {Error} If the Matrix client is not initialized or the room is not found.
 */
export default async function searchAllEventsLocally(term: string, roomId: string | undefined): Promise<SearchResult> {
    const searchResult: SearchResult = {
        _query: term,
        results: [],
        highlights: [],
        count: 0,
    };

    const client: MatrixClient | null = MatrixClientPeg.get();
    if (!client) {
        throw new Error("Matrix client is not initialized");
    }

    const room: Room | null = client.getRoom(roomId);
    if (!room) {
        throw new Error("Room not found");
    }

    const members = room.getLiveTimeline().getState(EventTimeline.FORWARDS)?.getMembers();
    const termObj: SearchTerm = makeSearchTermObject(term.trim());

    if (termObj.isEmptySearch) {
        return searchResult;
    }

    let matchingMembers: Member[] = [];
    if (members && Array(members).length) {
        matchingMembers = members.filter((member: RoomMember) => isMemberMatch(member, termObj));
    }

    const memberObj: MemberObj = {};
    for (let i = 0; i < matchingMembers.length; i++) {
        memberObj[matchingMembers[i].userId] = matchingMembers[i];
    }

    await loadFullHistory(client, room);
    const matches = await findAllMatches(termObj, room, memberObj);

    processSearchResults(searchResult, matches, termObj);

    // console.log("Search results 1: ", searchResult);

    // const results = searchResult.results;

    // results.forEach(result => {
    //     result.context.timeline = result.context.timeline.reverse();
    // });

    // console.log("Search results 2: ", searchResult);

    return searchResult;
}

/**
 * Loads the full history of events for a given room.
 *
 * @param client - The Matrix client instance.
 * @param room - The room for which to load the history.
 * @returns A promise that resolves when the full history is loaded.
 * @throws {Error} If the Matrix client is not initialized.
 */
async function loadFullHistory(client: MatrixClient | null, room: Room): Promise<void> {
    let hasMoreEvents = true;
    do {
        try {
            // get the first neighbour of the live timeline on every iteration
            // as each time we paginate, two timelines could have overlapped and connected, and the new
            // pagination token ends up on the first one.
            const timeline: EventTimeline | null = getFirstLiveTimelineNeighbour(room);
            if (!timeline) {
                throw new Error("Timeline not found");
            }
            if (client && timeline) {
                hasMoreEvents = await client.paginateEventTimeline(timeline, { limit: 100, backwards: true });
            } else {
                throw new Error("Matrix client is not initialized");
            }
        } catch (err: any) {
            // deal with rate-limit error
            if (err.name === "M_LIMIT_EXCEEDED") {
                const waitTime = err.data.retry_after_ms;
                await new Promise((r) => setTimeout(r, waitTime));
            } else {
                throw err;
            }
        }
    } while (hasMoreEvents);
}

/**
 * Retrieves the first live timeline neighbour of a given room.
 * A live timeline neighbour is a timeline that is adjacent to the current timeline in the backwards direction.
 *
 * @param room - The room for which to retrieve the first live timeline neighbour.
 * @returns The first live timeline neighbour if found, otherwise null.
 */
function getFirstLiveTimelineNeighbour(room: Room): EventTimeline | null {
    const liveTimeline = room.getLiveTimeline();
    let timeline = liveTimeline;
    while (timeline) {
        const neighbour = timeline.getNeighbouringTimeline(EventTimeline.BACKWARDS);
        if (!neighbour) {
            return timeline;
        }
        timeline = neighbour;
    }
    return null;
}

/**
 * Iterates over all events in a room and invokes a callback function for each event.
 * The iteration starts from the most recent event and goes backwards in time.
 *
 * @param room - The room to iterate over.
 * @param callback - The callback function to invoke for each event.
 */
function iterateAllEvents(room: Room, callback: (event: MatrixEvent) => void): void {
    let timeline: EventTimeline | null = room.getLiveTimeline();
    while (timeline) {
        const events = timeline.getEvents();
        for (let i = events.length - 1; i >= 0; i--) {
            callback(events[i]);
        }
        timeline = timeline.getNeighbouringTimeline(EventTimeline.BACKWARDS);
    }
}

/**
 * Finds all matches in a room based on the given search term object and matching members.
 *
 * @param termObj - The search term object.
 * @param room - The room to search in.
 * @param matchingMembers - The matching members.
 * @returns A promise that resolves to an array of search result items.
 */
export async function findAllMatches(termObj: SearchTerm, room: Room, matchingMembers: MemberObj): Promise<any[]> {
    return new Promise((resolve) => {
        const matches: SearchResultItem[] = [];
        let searchHit: SearchResultItem | null = null;
        let mostRecentEvent: MatrixEvent | null = null;
        const iterationCallback = (roomEvent: MatrixEvent): void => {
            if (searchHit !== null) {
                searchHit.context.addEvents([roomEvent], false);
            }
            searchHit = null;

            if (roomEvent.getType() === "m.room.message" && !roomEvent.isRedacted()) {
                if (eventMatchesSearchTerms(termObj, roomEvent, matchingMembers)) {
                    const evCtx = new EventContext(roomEvent);
                    if (mostRecentEvent !== null) {
                        evCtx.addEvents([mostRecentEvent], true);
                    }

                    const resObj: SearchResultItem = { result: roomEvent, context: evCtx };

                    matches.push(resObj);
                    searchHit = resObj;
                    return;
                }
            }
            mostRecentEvent = roomEvent;
        };

        iterateAllEvents(room, iterationCallback);
        resolve(matches);
    });
}

/**
 * Checks if a room member matches the given search term.
 * @param member - The room member to check.
 * @param termObj - The search term object.
 * @returns True if the member matches the search term, false otherwise.
 */
export function isMemberMatch(member: RoomMember, termObj: SearchTerm): boolean {
    const memberName = member.name.toLowerCase();
    if (termObj.searchTypeAdvanced === true) {
        const expResults = termObj.searchExpression && memberName.match(termObj.searchExpression);
        if (expResults && expResults.length > 0) {
            for (let i = 0; i < expResults.length; i++) {
                if (termObj.regExpHighlightMap && !termObj.regExpHighlightMap[expResults[i]]) {
                    termObj.regExpHighlightMap[expResults[i]] = true;
                    termObj.regExpHighlights.push(expResults[i]);
                }
            }
            return true;
        }
        return false;
    }

    if (termObj.fullText && memberName.indexOf(termObj.fullText) > -1) {
        return true;
    }

    for (let i = 0; i < termObj.words.length; i++) {
        const word = termObj.words[i].word;
        if (memberName.indexOf(word) === -1) {
            return false;
        }
    }

    return true;
}

/**
 * Checks if an event matches the given search terms.
 * @param searchTermObj - The search term object containing the search criteria.
 * @param evt - The Matrix event to be checked.
 * @param matchingMembers - The object containing matching members.
 * @returns True if the event matches the search terms, false otherwise.
 */
export function eventMatchesSearchTerms(
    searchTermObj: SearchTerm,
    evt: MatrixEvent,
    matchingMembers: MemberObj,
): boolean {
    const content = evt.getContent();
    const sender = evt.getSender();
    const loweredEventContent = content.body.toLowerCase();

    const evtDate = evt.getDate();
    const dateIso = evtDate && evtDate.toISOString();
    const dateLocale = evtDate && evtDate.toLocaleString();

    // if (matchingMembers[sender?.userId] !== undefined) {
    if (sender && matchingMembers[sender] !== undefined) {
        return true;
    }

    if (searchTermObj.searchTypeAdvanced === true) {
        const expressionResults = loweredEventContent.match(searchTermObj.searchExpression);
        if (expressionResults && expressionResults.length > 0) {
            for (let i = 0; i < expressionResults.length; i++) {
                if (searchTermObj.regExpHighlightMap && !searchTermObj.regExpHighlightMap[expressionResults[i]]) {
                    searchTermObj.regExpHighlightMap[expressionResults[i]] = true;
                    searchTermObj.regExpHighlights.push(expressionResults[i]);
                }
            }
            return true;
        }

        let dateIsoExprResults;
        let dateLocaleExprResults;
        if (dateIso && dateLocale && searchTermObj.searchExpression instanceof RegExp) {
            dateIsoExprResults = dateIso.match(searchTermObj.searchExpression);
            dateLocaleExprResults = dateLocale.match(searchTermObj.searchExpression);
        }

        if (
            (dateIsoExprResults && dateIsoExprResults.length > 0) ||
            (dateLocaleExprResults && dateLocaleExprResults.length > 0)
        ) {
            return true;
        }

        return false;
    }

    if (loweredEventContent.indexOf(searchTermObj.fullText) > -1) {
        return true;
    }

    if (
        (dateIso && searchTermObj.fullText && dateIso.indexOf(searchTermObj.fullText) > -1) ||
        (dateLocale && searchTermObj.fullText && dateLocale.indexOf(searchTermObj.fullText) > -1)
    ) {
        return true;
    }

    if (searchTermObj.words.length > 0) {
        for (let i = 0; i < searchTermObj.words.length; i++) {
            const word = searchTermObj.words[i];
            if (loweredEventContent.indexOf(word) === -1) {
                return false;
            }
        }
        return true;
    }

    return false;
}

/**
 * Creates a search term object based on the provided search term.
 * @param searchTerm - The search term to create the object from.
 * @returns The created search term object.
 */
export function makeSearchTermObject(searchTerm: string): SearchTerm {
    let term = searchTerm.toLowerCase();
    if (term.indexOf("rx:") === 0) {
        term = searchTerm.substring(3).trim();
        return {
            searchTypeAdvanced: true,
            searchTypeNormal: false,
            searchExpression: new RegExp(term),
            words: [],
            regExpHighlights: [],
            regExpHighlightMap: {},
            isEmptySearch: term.length === 0,
        };
    }

    const words = term
        .split(" ")
        .filter((w) => w)
        .map(function (w) {
            return { word: w, highlight: false };
        });

    return {
        searchTypeAdvanced: false,
        searchTypeNormal: true,
        fullText: term,
        words: words,
        regExpHighlights: [],
        isEmptySearch: term.length === 0,
    };
}

/**
 * Processes the search results and updates the searchResults object.
 *
 * @param searchResults - The search results object to be updated.
 * @param matches - An array of matches.
 * @param termObj - The search term object.
 * @returns The updated searchResults object.
 */
function processSearchResults(searchResults: SearchResult, matches: any[], termObj: SearchTerm): SearchResult {
    for (let i = 0; i < matches.length; i++) {
        const sr = new ElementSearchResult(1, matches[i].context);
        // sr.context.timeline = sr.context.timeline.reverse();
        searchResults.results.push(sr);
    }

    const highlights = termObj.words.filter((w) => w.highlight).map((w) => w.word);
    searchResults.highlights = highlights;
    for (let i = 0; i < termObj.regExpHighlights.length; i++) {
        searchResults.highlights.push(termObj.regExpHighlights[i]);
    }
    searchResults.count = matches.length;
    return searchResults;
}
