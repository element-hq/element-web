/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    ClientEvent,
    EventType,
    type MatrixEvent,
    type Room,
    RoomEvent,
    RoomMemberEvent,
    type RoomState,
    RoomStateEvent,
    type RoomMember as SdkRoomMember,
    type User,
    UserEvent,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { throttle } from "lodash";

import { type RoomMember } from "../../../models/rooms/RoomMember";
import { mediaFromMxc } from "../../../customisations/Media";
import UserIdentifierCustomisations from "../../../customisations/UserIdentifier";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";
import { type PresenceState } from "../../../models/rooms/PresenceState";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { SDKContext } from "../../../contexts/SDKContext";
import PosthogTrackers from "../../../PosthogTrackers";
import { type ButtonEvent } from "../../views/elements/AccessibleButton";
import { inviteToRoom } from "../../../utils/room/inviteToRoom";
import { canInviteTo } from "../../../utils/room/canInviteTo";
import { isValid3pidInvite } from "../../../RoomInvite";
import { type ThreePIDInvite } from "../../../models/rooms/ThreePIDInvite";
import { type XOR } from "../../../@types/common";
import { useTypedEventEmitter } from "../../../hooks/useEventEmitter";

type Member = XOR<{ member: RoomMember }, { threePidInvite: ThreePIDInvite }>;

export function getPending3PidInvites(room: Room, searchQuery?: string): Member[] {
    // include 3pid invites (m.room.third_party_invite) state events.
    // The HS may have already converted these into m.room.member invites so
    // we shouldn't add them if the 3pid invite state key (token) is in the
    // member invite (content.third_party_invite.signed.token)
    const inviteEvents = room.currentState.getStateEvents("m.room.third_party_invite").filter(function (e) {
        if (!isValid3pidInvite(e)) return false;
        if (searchQuery && !(e.getContent().display_name as string)?.includes(searchQuery)) return false;

        // discard all invites which have a m.room.member event since we've
        // already added them.
        const memberEvent = room.currentState.getInviteForThreePidToken(e.getStateKey()!);
        if (memberEvent) return false;
        return true;
    });
    const invites: Member[] = inviteEvents.map((e) => {
        return {
            threePidInvite: {
                event: e,
            },
        };
    });
    return invites;
}

export function sdkRoomMemberToRoomMember(member: SdkRoomMember): Member {
    const displayUserId =
        UserIdentifierCustomisations.getDisplayUserIdentifier(member.userId, {
            roomId: member.roomId,
        }) ?? member.userId;

    const mxcAvatarURL = member.getMxcAvatarUrl();
    const avatarThumbnailUrl =
        (mxcAvatarURL && mediaFromMxc(mxcAvatarURL).getThumbnailOfSourceHttp(96, 96, "crop")) ?? undefined;

    const user = member.user;
    let presenceState: PresenceState | undefined;
    if (user) {
        presenceState = (user.presence as PresenceState) || undefined;
    }

    return {
        member: {
            roomId: member.roomId,
            userId: member.userId,
            displayUserId: displayUserId,
            name: member.name,
            rawDisplayName: member.rawDisplayName,
            disambiguate: member.disambiguate,
            avatarThumbnailUrl: avatarThumbnailUrl,
            powerLevel: member.powerLevel,
            lastModifiedTime: member.getLastModifiedTime(),
            presenceState,
            isInvite: member.membership === KnownMembership.Invite,
        },
    };
}

export const SEPARATOR = "SEPARATOR";
export type MemberWithSeparator = Member | typeof SEPARATOR;

export interface MemberListViewState {
    members: MemberWithSeparator[];
    memberCount: number;
    search: (searchQuery: string) => void;
    isPresenceEnabled: boolean;
    shouldShowInvite: boolean;
    shouldShowSearch: boolean;
    isLoading: boolean;
    canInvite: boolean;
    onInviteButtonClick: (ev: ButtonEvent) => void;
}
export function useMemberListViewModel(roomId: string): MemberListViewState {
    const cli = useMatrixClientContext();

    const room = useMemo(() => cli.getRoom(roomId), [roomId, cli]);
    if (!room) {
        throw new Error(`Room with id ${roomId} does not exist!`);
    }

    const sdkContext = useContext(SDKContext);
    const [memberMap, setMemberMap] = useState<Map<string, MemberWithSeparator>>(new Map());
    const [isLoading, setIsLoading] = useState<boolean>(true);
    // This is the last known total number of members in this room.
    const [totalMemberCount, setTotalMemberCount] = useState(0);
    /**
     * This is the current number of members in the list.
     * This number will be less than the total number of members
     * in the room when the search functionality is used.
     */
    const [memberCount, setMemberCount] = useState(0);

    const loadMembers = useMemo(
        () =>
            throttle(
                async (searchQuery?: string): Promise<void> => {
                    const { joined: joinedSdk, invited: invitedSdk } = await sdkContext.memberListStore.loadMemberList(
                        roomId,
                        searchQuery,
                    );
                    const threePidInvited = getPending3PidInvites(room, searchQuery);

                    const newMemberMap = new Map<string, MemberWithSeparator>();

                    // First add the joined room members
                    for (const member of joinedSdk) {
                        const roomMember = sdkRoomMemberToRoomMember(member);
                        newMemberMap.set(member.userId, roomMember);
                    }

                    // Then a separator if needed
                    if (joinedSdk.length > 0 && (invitedSdk.length > 0 || threePidInvited.length > 0))
                        newMemberMap.set(SEPARATOR, SEPARATOR);

                    // Then add the invited room members
                    for (const member of invitedSdk) {
                        const roomMember = sdkRoomMemberToRoomMember(member);
                        newMemberMap.set(member.userId, roomMember);
                    }

                    // Finally add the third party invites
                    for (const invited of threePidInvited) {
                        const key = invited.threePidInvite!.event.getContent().display_name;
                        newMemberMap.set(key, invited);
                    }

                    setMemberMap(newMemberMap);
                    setMemberCount(joinedSdk.length + invitedSdk.length + threePidInvited.length);
                    if (!searchQuery) {
                        /**
                         * Since searching for members only gives you the relevant
                         * members matching the query, do not update the totalMemberCount!
                         **/
                        setTotalMemberCount(newMemberMap.size);
                    }
                },
                500,
                { leading: true, trailing: true },
            ),
        [sdkContext.memberListStore, roomId, room],
    );

    const isPresenceEnabled = useMemo(
        () => sdkContext.memberListStore.isPresenceEnabled(),
        [sdkContext.memberListStore],
    );

    // Determines whether the rendered invite button is enabled or disabled
    const getCanUserInviteToThisRoom = useCallback((): boolean => !!room && canInviteTo(room), [room]);
    const [canInvite, setCanInvite] = useState<boolean>(getCanUserInviteToThisRoom());

    // Determines whether the invite button should be shown or not.
    const getShouldShowInvite = useCallback(
        (): boolean => room?.getMyMembership() === KnownMembership.Join && shouldShowComponent(UIComponent.InviteUsers),
        [room],
    );
    const [shouldShowInvite, setShouldShowInvite] = useState<boolean>(getShouldShowInvite());

    const onInviteButtonClick = (ev: ButtonEvent): void => {
        PosthogTrackers.trackInteraction("WebRightPanelMemberListInviteButton", ev);
        ev.preventDefault();
        inviteToRoom(room);
    };

    useTypedEventEmitter(cli, RoomStateEvent.Events, (event: MatrixEvent) => {
        if (event.getRoomId() === roomId && event.getType() === EventType.RoomThirdPartyInvite) {
            loadMembers();
            const newCanInvite = getCanUserInviteToThisRoom();
            setCanInvite(newCanInvite);
        }
    });

    useTypedEventEmitter(cli, RoomStateEvent.Update, (state: RoomState) => {
        if (state.roomId === roomId) loadMembers();
    });

    useTypedEventEmitter(cli, RoomMemberEvent.Name, (_: MatrixEvent, member: SdkRoomMember) => {
        if (member.roomId === roomId) loadMembers();
    });

    useTypedEventEmitter(cli, ClientEvent.Room, (room: Room) => {
        // We listen for room events because when we accept an invite
        // we need to wait till the room is fully populated with state
        // before refreshing the member list else we get a stale list.
        if (room.roomId === roomId) loadMembers();
    });

    useTypedEventEmitter(cli, RoomEvent.MyMembership, (room: Room, membership: string, oldMembership?: string) => {
        if (room.roomId !== roomId) return;
        if (membership === KnownMembership.Join && oldMembership !== KnownMembership.Join) {
            // we just joined the room, load the member list
            loadMembers();
            const newShouldShowInvite = getShouldShowInvite();
            setShouldShowInvite(newShouldShowInvite);
        }
    });

    useTypedEventEmitter(cli, UserEvent.Presence, (_: MatrixEvent | undefined, user: User) => {
        if (memberMap.has(user.userId)) loadMembers();
    });

    useTypedEventEmitter(cli, UserEvent.CurrentlyActive, (_: MatrixEvent | undefined, user: User) => {
        if (memberMap.has(user.userId)) loadMembers();
    });

    // Initial load of the memberlist
    useEffect(() => {
        (async () => {
            await loadMembers();
            /**
             * isLoading is used to render a spinner on initial call.
             * Further calls need not mutate this state since it's perfectly fine to
             * show the existing memberlist until the new one loads.
             */
            setIsLoading(false);
        })();
    }, [loadMembers]);

    return {
        members: Array.from(memberMap.values()),
        memberCount,
        search: loadMembers,
        shouldShowInvite,
        isPresenceEnabled,
        isLoading,
        onInviteButtonClick,
        shouldShowSearch: totalMemberCount >= 20,
        canInvite,
    };
}
