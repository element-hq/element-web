/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useEffect, useRef, useState } from "react";
import { EventType, type RoomMember } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../MatrixClientPeg";
import eventSearch from "../Searching";

export interface MessageSearchResult {
    eventId: string;
    roomId: string;
    senderName: string;
    member?: RoomMember;
    timestamp: Date;
    body: string;
}

const DEBOUNCE_MS = 400;

export function useMessageSearch(query: string): { results: MessageSearchResult[]; loading: boolean } {
    const [results, setResults] = useState<MessageSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        const trimmed = query.trim();
        if (!trimmed) {
            setResults([]);
            setLoading(false);
            return;
        }

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true);

        const cli = MatrixClientPeg.safeGet();
        const timeoutId = setTimeout(() => {
            eventSearch(cli, trimmed, undefined, controller.signal)
                .then((searchResults) => {
                    if (controller.signal.aborted) return;
                    const mapped = searchResults.results.flatMap((r) => {
                        const event = r.context.getEvent();
                        if (event.getType() !== EventType.RoomMessage) return [];
                        const roomId = event.getRoomId();
                        const senderId = event.getSender();
                        if (!roomId || !senderId) return [];
                        const body = event.getContent().body as string | undefined;
                        if (!body) return [];
                        const room = cli.getRoom(roomId);
                        const member = room?.getMember(senderId) ?? undefined;
                        return [
                            {
                                eventId: event.getId() ?? "",
                                roomId,
                                senderName: member?.rawDisplayName ?? member?.name ?? senderId,
                                member,
                                timestamp: event.getDate() ?? new Date(event.getTs()),
                                body,
                            },
                        ];
                    });
                    setResults(mapped);
                })
                .catch((err: unknown) => {
                    if (controller.signal.aborted) return;
                    console.error("Message search failed", err);
                    setResults([]);
                })
                .finally(() => {
                    if (!controller.signal.aborted) setLoading(false);
                });
        }, DEBOUNCE_MS);

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [query]);

    return { results, loading };
}
