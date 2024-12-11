/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

import {
    ClientEvent,
    EventType,
    MatrixEvent,
    Room,
    RoomEvent,
    RoomMemberEvent,
    RoomState,
    RoomStateEvent,
    RoomMember as SDKRoomMember,
    User,
    UserEvent,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { throttle } from "lodash";

import { RoomMember } from "../../models/rooms/RoomMember";
import { mediaFromMxc } from "../../customisations/Media";
import UserIdentifierCustomisations from "../../customisations/UserIdentifier";
import { shouldShowComponent } from "../../customisations/helpers/UIComponents";
import { UIComponent } from "../../settings/UIFeature";
import { PresenceState } from "../../models/rooms/PresenceState";
import { useMatrixClientContext } from "../../contexts/MatrixClientContext";
import { SDKContext } from "../../contexts/SDKContext";
import PosthogTrackers from "../../PosthogTrackers";
import { ButtonEvent } from "../views/elements/AccessibleButton";
import { inviteToRoom } from "../../utils/room/inviteToRoom";
import { canInviteTo } from "../../utils/room/canInviteTo";
import { isValid3pidInvite } from "../../RoomInvite";
import { ThreePIDInvite } from "../../models/rooms/ThreePIDInvite";
import { XOR } from "../../@types/common";

type Member = XOR<{ member: RoomMember }, { threePidInvite: ThreePIDInvite }>;

function getPending3PidInvites(room: Room, searchQuery?: string): Member[] {
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
                displayName: e.getContent().display_name,
                event: e,
            },
        };
    });
    return invites;
}

function sdkRoomMemberToRoomMember(member: SDKRoomMember): Member {
    const displayUserId =
        UserIdentifierCustomisations.getDisplayUserIdentifier(member.userId, {
            roomId: member.roomId,
        }) ?? member.userId;

    const mxcAvatarURL = member.getMxcAvatarUrl();
    const avatarThumbnailUrl =
        (mxcAvatarURL && mediaFromMxc(mxcAvatarURL).getThumbnailOfSourceHttp(10, 10)) ?? undefined;

    const user = member.user;
    let presenceState: PresenceState | undefined = undefined;
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

export interface MemberListViewState {
    members: Member[];
    memberCount: number;
    search: (searchQuery: string) => void;
    isPresenceEnabled: boolean;
    shouldShowInvite: boolean;
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
    const [members, setMembers] = useState<Member[]>([]);
    const [memberCount, setMemberCount] = useState<number>(0);
    const searchQuery = useRef("");
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const loadMembers = useMemo(
        () =>
            throttle(
                async (): Promise<void> => {
                    const { joined: joinedSdk, invited: invitedSdk } = await sdkContext.memberListStore.loadMemberList(
                        roomId,
                        searchQuery.current,
                    );
                    const joined = joinedSdk.map(sdkRoomMemberToRoomMember);
                    const invited = invitedSdk.map(sdkRoomMemberToRoomMember);
                    const threePidInvited = getPending3PidInvites(room, searchQuery.current);
                    const newMembers = [...invited, ...threePidInvited, ...joined];
                    setMembers(newMembers);
                    if (!searchQuery.current) setMemberCount(newMembers.length);
                },
                500,
                { leading: true, trailing: true },
            ),
        //todo: can we remove room here?
        [roomId, sdkContext.memberListStore, room],
    );

    const search = useCallback(
        (query: string) => {
            searchQuery.current = query;
            loadMembers();
        },
        [loadMembers],
    );

    const isPresenceEnabled = useMemo(
        () => sdkContext.memberListStore.isPresenceEnabled(),
        [sdkContext.memberListStore],
    );

    const getCanUserInviteToThisRoom = useCallback((): boolean => !!room && canInviteTo(room), [room]);

    const [canInvite, setCanInvite] = useState<boolean>(getCanUserInviteToThisRoom());

    const shouldShowInvite = useMemo(() => {
        return room?.getMyMembership() == KnownMembership.Join && shouldShowComponent(UIComponent.InviteUsers);
    }, [room]);

    const onInviteButtonClick = (ev: ButtonEvent): void => {
        PosthogTrackers.trackInteraction("WebRightPanelMemberListInviteButton", ev);
        ev.preventDefault();
        inviteToRoom(room);
    };

    useEffect(() => {
        const onRoomStateUpdate = (state: RoomState): void => {
            if (state.roomId === roomId) loadMembers();
        };

        const onRoomMemberName = (ev: MatrixEvent, member: SDKRoomMember): void => {
            if (member.roomId === roomId) loadMembers();
        };

        const onRoomStateEvent = (event: MatrixEvent): void => {
            if (event.getRoomId() === roomId && event.getType() === EventType.RoomThirdPartyInvite) loadMembers();
            const newCanInvite = getCanUserInviteToThisRoom();
            setCanInvite(newCanInvite);
        };

        const onRoom = (room: Room): void => {
            if (room.roomId === roomId) loadMembers();
            // We listen for room events because when we accept an invite
            // we need to wait till the room is fully populated with state
            // before refreshing the member list else we get a stale list.
            // this.onMemberListUpdated?.(true);
        };

        const onMyMembership = (room: Room, membership: string, oldMembership?: string): void => {
            if (room.roomId !== roomId) return;

            if (membership === KnownMembership.Join && oldMembership !== KnownMembership.Join) {
                // we just joined the room, load the member list
                loadMembers();
            }
        };

        const onUserPresenceChange = (event: MatrixEvent | undefined, user: User): void => {
            loadMembers();
        };

        cli.on(RoomStateEvent.Update, onRoomStateUpdate);
        cli.on(RoomMemberEvent.Name, onRoomMemberName);
        cli.on(RoomStateEvent.Events, onRoomStateEvent);
        cli.on(ClientEvent.Room, onRoom); // invites & joining after peek
        cli.on(RoomEvent.MyMembership, onMyMembership);
        cli.on(UserEvent.LastPresenceTs, onUserPresenceChange);
        cli.on(UserEvent.Presence, onUserPresenceChange);
        cli.on(UserEvent.CurrentlyActive, onUserPresenceChange);

        // Initial load of the memberlist
        (async () => {
            await loadMembers();
            /**
             * isLoading is used to render a spinner on initial call.
             * Further calls need not mutate this state since it's perfectly fine to
             * show the existing memberlist until the new one loads.
             */
            setIsLoading(false);
        })();

        return () => {
            cli.off(RoomStateEvent.Update, onRoomStateUpdate);
            cli.off(RoomMemberEvent.Name, onRoomMemberName);
            cli.off(RoomStateEvent.Events, onRoomStateEvent);
            cli.off(ClientEvent.Room, onRoom); // invites & joining after peek
            cli.off(RoomEvent.MyMembership, onMyMembership);
            cli.off(UserEvent.LastPresenceTs, onUserPresenceChange);
            cli.off(UserEvent.Presence, onUserPresenceChange);
            cli.off(UserEvent.CurrentlyActive, onUserPresenceChange);
        };
    }, [cli, loadMembers, roomId, getCanUserInviteToThisRoom]);

    return {
        members,
        memberCount,
        search,
        shouldShowInvite,
        isPresenceEnabled,
        isLoading,
        onInviteButtonClick,
        canInvite,
    };
}
