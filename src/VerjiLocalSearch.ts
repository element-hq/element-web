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
    SearchResult,
    ISearchResults,
    ISearchResponse,
    // ISearchResult,
    // IEventWithRoomId
} from "matrix-js-sdk/src/matrix";
import { EventContext } from "matrix-js-sdk/src/models/event-context"; // eslint-disable-line

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

export interface SearchResultItem {
    result: MatrixEvent;
    context: EventContext;
}

/**
 * Searches all events locally based on the provided search term and room ID.
 *
 * @param {MatrixClient} client - The Matrix client instance.
 * @param {string} term - The search term.
 * @param {string | undefined} roomId - The ID of the room to search in.
 * @returns {Promise<ISearchResults>} A promise that resolves to the search results.
 * @throws {Error} If the Matrix client is not initialized or the room is not found.
 */
export default async function searchAllEventsLocally(
    client: MatrixClient,
    term: string,
    roomId: string | undefined,
): Promise<ISearchResults> {
    const searchResults: ISearchResults = {
        results: [],
        highlights: [],
        count: 0,
    };

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
        return searchResults;
    }

    let matchingMembers: Member[] = [];
    if (Array.isArray(members) && members.length) {
        matchingMembers = members.filter((member: RoomMember) => isMemberMatch(member, termObj));
    }

    const memberObj: MemberObj = {};
    for (let i = 0; i < matchingMembers.length; i++) {
        memberObj[matchingMembers[i].userId] = matchingMembers[i];
    }

    await loadFullHistory(client, room);

    // Search and return intermediary form of matches
    const matches = findAllMatches(termObj, room, memberObj);

    // search context is reversed there ☝️, so fix
    //matches.forEach(m => m.context = reverseEventContext(m.context));

    // Process the matches to produce the equivalent result from a client.search() call
    const searchResponse = getClientSearchResponse(searchResults, matches);

    // mimic the original code
    const results = client.processRoomEventsSearch(searchResults, searchResponse);

    return results;
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
 * Finds all matches in a room based on the given search term object and matching members.
 *
 * @param {SearchTerm} termObj - The search term object.
 * @param {Room} room - The room to search in.
 * @param {MemberObj} matchingMembers - The matching members.
 * @returns {SearchResultItem[]} An array of search result items.
 */
export function findAllMatches(termObj: SearchTerm, room: Room, matchingMembers: MemberObj): SearchResultItem[] {
    const matches: SearchResultItem[] = [];
    let searchHit: SearchResultItem | null = null;
    let prevEvent: MatrixEvent | null = null;
    let timeline: EventTimeline | null = room.getLiveTimeline();

    const iterationCallback = (roomEvent: MatrixEvent): void => {
        if (searchHit !== null) {
            searchHit.context.addEvents([roomEvent], false);
        }
        searchHit = null;

        if (roomEvent.getType() === "m.room.message" && !roomEvent.isRedacted()) {
            if (eventMatchesSearchTerms(termObj, roomEvent, matchingMembers)) {
                const evCtx = new EventContext(roomEvent);
                if (prevEvent !== null) {
                    evCtx.addEvents([prevEvent], true);
                }

                const resObj: SearchResultItem = { result: roomEvent, context: evCtx };
                matches.push(resObj);
                searchHit = resObj;
            }

            prevEvent = roomEvent;
        }
    };

    // This code iterates over a timeline, retrieves events from the timeline, and invokes a callback function for each event in reverse order.
    while (timeline) {
        const events = timeline.getEvents();
        for (let i = events.length - 1; i >= 0; i--) {
            iterationCallback(events[i]);
        }
        timeline = timeline.getNeighbouringTimeline(EventTimeline.FORWARDS);
    }

    return matches;
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
 * Reverses the order of events in the given event context.
 *
 * @param {EventContext} context - The event context to reverse.
 * @returns {EventContext} The reversed event context.
 */
export function reverseEventContext(eventContext: EventContext): EventContext {
    const contextTimeline = eventContext.getTimeline();
    const ourEventIndex = eventContext.getOurEventIndex();
    const ourEvent = eventContext.getEvent();
    const reversedContext = new EventContext(contextTimeline[ourEventIndex]);
    let afterOurEvent = false;

    for (let i = 0; i < contextTimeline.length; i++) {
        const event = contextTimeline[i];
        if (event.getId() === ourEvent.getId()) {
            afterOurEvent = true;
            continue;
        }
        if (afterOurEvent) {
            reversedContext.addEvents([event], true);
        } else {
            reversedContext.addEvents([event], false);
        }
    }

    return reversedContext;
}

/**
 * Transform the matches by projecting them into a ISearchResponse
 *
 * @param searchResults - The search results object to be updated.
 * @param matches - An array of matches.
 * @param termObj - The search term object.
 * @returns The updated searchResults object.
 */
function getClientSearchResponse(searchResults: ISearchResults, matches: SearchResultItem[]): ISearchResponse {
    const response: ISearchResponse = {
        search_categories: {
            room_events: {
                count: 0,
                highlights: [],
                results: [],
            },
        },
    };

    response.search_categories.room_events.count = matches.length;
    for (let i = 0; i < matches.length; i++) {
        const reversedContext = reverseEventContext(matches[i].context);

        const sr = new SearchResult(0, reversedContext);
        searchResults.results.push(sr);
    }

    return response;
}
