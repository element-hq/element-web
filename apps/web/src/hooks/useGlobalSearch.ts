/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useMemo, useState } from "react";
import { type Room, RoomMember, RoomType } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { normalize } from "matrix-js-sdk/src/utils";

import { MatrixClientPeg } from "../MatrixClientPeg";
import { useDebouncedCallback } from "./spotlight/useDebouncedCallback";
import { useProfileInfo } from "./useProfileInfo";
import { useUserDirectory } from "./useUserDirectory";
import { DirectoryMember, type Member } from "../utils/direct-messages";
import DMRoomMap from "../utils/DMRoomMap";
import { buildActivityScores, buildMemberScores, compareMembers } from "../utils/SortMembers";
import { RecentAlgorithm } from "../stores/room-list/algorithms/tag-sorting/RecentAlgorithm";
import { isLocalRoom } from "../utils/localRoom/isLocalRoom";
import { filterBoolean } from "../utils/arrays";

// ── Public filter enum ────────────────────────────────────────────────────────

export enum GlobalSearchFilter {
    All = "All",
    People = "People",
    Rooms = "Rooms",
    Spaces = "Spaces",
    Messages = "Messages",
}

// ── Result types ──────────────────────────────────────────────────────────────

export interface PersonResult {
    kind: "person";
    userId: string;
    name: string;
    avatarUrl?: string;
    /** Underlying room if this person has an existing DM */
    dmRoom?: Room;
    member: Member | RoomMember;
}

export interface RoomResult {
    kind: "room";
    roomId: string;
    name: string;
    address?: string;
    avatarUrl?: string;
    room: Room;
}

export interface SpaceResult {
    kind: "space";
    roomId: string;
    name: string;
    address?: string;
    avatarUrl?: string;
    room: Room;
}

export type GlobalSearchResult = PersonResult | RoomResult | SpaceResult;

export interface GlobalSearchResults {
    people: PersonResult[];
    rooms: RoomResult[];
    spaces: SpaceResult[];
    /** True while an async directory search is in flight */
    loading: boolean;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const recentAlgorithm = new RecentAlgorithm();

function getAvatarUrl(room: Room): string | undefined {
    const mxcUrl = room.getMxcAvatarUrl();
    if (!mxcUrl) return undefined;
    try {
        return MatrixClientPeg.safeGet().mxcUrlToHttp(mxcUrl, 36, 36, "crop") ?? undefined;
    } catch {
        return undefined;
    }
}

function getMemberAvatarUrl(member: Member | RoomMember): string | undefined {
    const mxcUrl =
        member instanceof RoomMember ? member.getMxcAvatarUrl() : (member as DirectoryMember).getMxcAvatarUrl?.();
    if (!mxcUrl) return undefined;
    try {
        return MatrixClientPeg.safeGet().mxcUrlToHttp(mxcUrl, 36, 36, "crop") ?? undefined;
    } catch {
        return undefined;
    }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseGlobalSearchOptions {
    query: string;
    filter: GlobalSearchFilter;
}

export function useGlobalSearch({ query, filter }: UseGlobalSearchOptions): GlobalSearchResults {
    const cli = MatrixClientPeg.safeGet();
    const trimmedQuery = query.trim();
    const lcQuery = trimmedQuery.toLowerCase();
    const normalizedQuery = normalize(trimmedQuery);

    // ── Member comparator (activity-based) ──
    const memberComparator = useMemo(() => {
        const activityScores = buildActivityScores(cli);
        const memberScores = buildMemberScores(cli);
        return compareMembers(activityScores, memberScores);
    }, [cli]);

    // ── User directory search ──
    const { loading: usersLoading, users: userDirectoryResults, search: searchPeople } = useUserDirectory();
    const { loading: profileLoading, profile, search: searchProfileInfo } = useProfileInfo();

    const searchParams: [{ query: string; limit: number }] = useMemo(
        () => [{ query: trimmedQuery, limit: 50 }],
        [trimmedQuery],
    );

    const shouldSearchPeople = filter === GlobalSearchFilter.All || filter === GlobalSearchFilter.People;
    useDebouncedCallback(shouldSearchPeople && trimmedQuery.length > 0, searchPeople, searchParams);
    useDebouncedCallback(shouldSearchPeople && trimmedQuery.length > 0, searchProfileInfo, searchParams);

    // ── Visible rooms from the client ──
    const visibleRooms = useMemo(() => {
        return cli.getVisibleRooms(false).filter((room) => {
            if (isLocalRoom(room)) return false;
            return (
                room.getMyMembership() === KnownMembership.Join ||
                room.getMyMembership() === KnownMembership.Invite
            );
        });
    }, [cli]);

    // ── Build person results ──
    const people = useMemo<PersonResult[]>(() => {
        if (filter === GlobalSearchFilter.Rooms || filter === GlobalSearchFilter.Spaces) return [];

        // Map userId → existing DM room
        const dmMap = new Map<string, Room>();
        for (const room of visibleRooms) {
            const userId = DMRoomMap.shared().getUserIdForRoomId(room.roomId);
            if (userId && room.getJoinedMemberCount() <= 2) {
                dmMap.set(userId, room);
            }
        }

        const seen = new Set<string>();
        const results: PersonResult[] = [];

        // 1. People already in DM rooms
        for (const room of visibleRooms) {
            const userId = DMRoomMap.shared().getUserIdForRoomId(room.roomId);
            if (!userId || seen.has(userId)) continue;
            const myUserId = cli.getUserId();
            const member = room.getMembers().find((m) => m.userId !== myUserId);
            if (!member) continue;
            if (trimmedQuery && !member.name.toLowerCase().includes(lcQuery) && !member.userId.toLowerCase().includes(lcQuery)) continue;
            seen.add(userId);
            results.push({
                kind: "person",
                userId: member.userId,
                name: member.rawDisplayName ?? member.name,
                avatarUrl: getMemberAvatarUrl(member),
                dmRoom: room,
                member,
            });
        }

        // 2. Directory search results
        for (const user of [...userDirectoryResults, ...(profile ? [new DirectoryMember(profile)] : [])]) {
            if (seen.has(user.userId)) continue;
            seen.add(user.userId);
            results.push({
                kind: "person",
                userId: user.userId,
                name: user.name ?? user.userId,
                avatarUrl: getMemberAvatarUrl(user),
                dmRoom: dmMap.get(user.userId),
                member: user,
            });
        }

        results.sort((a, b) => memberComparator(a.member, b.member));
        return results;
    }, [cli, visibleRooms, userDirectoryResults, profile, filter, lcQuery, trimmedQuery, memberComparator]);

    // ── Build room results ──
    const rooms = useMemo<RoomResult[]>(() => {
        if (filter === GlobalSearchFilter.People || filter === GlobalSearchFilter.Spaces) return [];

        return visibleRooms
            .filter((room) => {
                if (room.isSpaceRoom()) return false;
                if (DMRoomMap.shared().getUserIdForRoomId(room.roomId)) return false;
                if (trimmedQuery) {
                    return (
                        room.normalizedName?.includes(normalizedQuery) ||
                        room.getCanonicalAlias()?.toLowerCase().includes(lcQuery) ||
                        false
                    );
                }
                return true;
            })
            .sort(
                (a, b) =>
                    recentAlgorithm.getLastTs(b, cli.getSafeUserId()) -
                    recentAlgorithm.getLastTs(a, cli.getSafeUserId()),
            )
            .map((room) => ({
                kind: "room" as const,
                roomId: room.roomId,
                name: room.name,
                address: room.getCanonicalAlias() ?? undefined,
                avatarUrl: getAvatarUrl(room),
                room,
            }));
    }, [cli, visibleRooms, filter, trimmedQuery, lcQuery, normalizedQuery]);

    // ── Build space results ──
    const spaces = useMemo<SpaceResult[]>(() => {
        if (filter === GlobalSearchFilter.People || filter === GlobalSearchFilter.Rooms) return [];

        return visibleRooms
            .filter((room) => {
                if (room.getType() !== RoomType.Space) return false;
                if (trimmedQuery) {
                    return (
                        room.normalizedName?.includes(normalizedQuery) ||
                        room.getCanonicalAlias()?.toLowerCase().includes(lcQuery) ||
                        false
                    );
                }
                return true;
            })
            .sort(
                (a, b) =>
                    recentAlgorithm.getLastTs(b, cli.getSafeUserId()) -
                    recentAlgorithm.getLastTs(a, cli.getSafeUserId()),
            )
            .map((room) => ({
                kind: "space" as const,
                roomId: room.roomId,
                name: room.name,
                address: room.getCanonicalAlias() ?? undefined,
                avatarUrl: getAvatarUrl(room),
                room,
            }));
    }, [cli, visibleRooms, filter, trimmedQuery, lcQuery, normalizedQuery]);

    return {
        people,
        rooms,
        spaces,
        loading: usersLoading || profileLoading,
    };
}
