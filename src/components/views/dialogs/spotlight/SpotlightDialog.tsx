/*
Copyright 2021 - 2023 The Matrix.org Foundation C.I.C.

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

import { WebSearch as WebSearchEvent } from "@matrix-org/analytics-events/types/typescript/WebSearch";
import classNames from "classnames";
import { capitalize, sum } from "lodash";
import { IHierarchyRoom } from "matrix-js-sdk/src/@types/spaces";
import { IPublicRoomsChunkRoom, MatrixClient, RoomMember, RoomType } from "matrix-js-sdk/src/matrix";
import { Room } from "matrix-js-sdk/src/models/room";
import { normalize } from "matrix-js-sdk/src/utils";
import React, { ChangeEvent, RefObject, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import sanitizeHtml from "sanitize-html";

import { KeyBindingAction } from "../../../../accessibility/KeyboardShortcuts";
import {
    findSiblingElement,
    RovingTabIndexContext,
    RovingTabIndexProvider,
    Type,
} from "../../../../accessibility/RovingTabIndex";
import { mediaFromMxc } from "../../../../customisations/Media";
import { Action } from "../../../../dispatcher/actions";
import defaultDispatcher from "../../../../dispatcher/dispatcher";
import { ViewRoomPayload } from "../../../../dispatcher/payloads/ViewRoomPayload";
import { useDebouncedCallback } from "../../../../hooks/spotlight/useDebouncedCallback";
import { useRecentSearches } from "../../../../hooks/spotlight/useRecentSearches";
import { useProfileInfo } from "../../../../hooks/useProfileInfo";
import { usePublicRoomDirectory } from "../../../../hooks/usePublicRoomDirectory";
import { useSpaceResults } from "../../../../hooks/useSpaceResults";
import { useUserDirectory } from "../../../../hooks/useUserDirectory";
import { getKeyBindingsManager } from "../../../../KeyBindingsManager";
import { _t } from "../../../../languageHandler";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import { PosthogAnalytics } from "../../../../PosthogAnalytics";
import { getCachedRoomIDForAlias } from "../../../../RoomAliasCache";
import { showStartChatInviteDialog } from "../../../../RoomInvite";
import { SettingLevel } from "../../../../settings/SettingLevel";
import SettingsStore from "../../../../settings/SettingsStore";
import { BreadcrumbsStore } from "../../../../stores/BreadcrumbsStore";
import { RoomNotificationState } from "../../../../stores/notifications/RoomNotificationState";
import { RoomNotificationStateStore } from "../../../../stores/notifications/RoomNotificationStateStore";
import { RecentAlgorithm } from "../../../../stores/room-list/algorithms/tag-sorting/RecentAlgorithm";
import { SdkContextClass } from "../../../../contexts/SDKContext";
import { getMetaSpaceName } from "../../../../stores/spaces";
import SpaceStore from "../../../../stores/spaces/SpaceStore";
import { DirectoryMember, Member, startDmOnFirstMessage } from "../../../../utils/direct-messages";
import DMRoomMap from "../../../../utils/DMRoomMap";
import { makeUserPermalink } from "../../../../utils/permalinks/Permalinks";
import { buildActivityScores, buildMemberScores, compareMembers } from "../../../../utils/SortMembers";
import { copyPlaintext } from "../../../../utils/strings";
import BaseAvatar from "../../avatars/BaseAvatar";
import DecoratedRoomAvatar from "../../avatars/DecoratedRoomAvatar";
import { SearchResultAvatar } from "../../avatars/SearchResultAvatar";
import { NetworkDropdown } from "../../directory/NetworkDropdown";
import AccessibleButton, { ButtonEvent } from "../../elements/AccessibleButton";
import LabelledCheckbox from "../../elements/LabelledCheckbox";
import Spinner from "../../elements/Spinner";
import NotificationBadge from "../../rooms/NotificationBadge";
import BaseDialog from "../BaseDialog";
import { Option } from "./Option";
import { PublicRoomResultDetails } from "./PublicRoomResultDetails";
import { RoomResultContextMenus } from "./RoomResultContextMenus";
import { RoomContextDetails } from "../../rooms/RoomContextDetails";
import { TooltipOption } from "./TooltipOption";
import { isLocalRoom } from "../../../../utils/localRoom/isLocalRoom";
import RoomAvatar from "../../avatars/RoomAvatar";
import { useFeatureEnabled } from "../../../../hooks/useSettings";
import { filterBoolean } from "../../../../utils/arrays";
import { transformSearchTerm } from "../../../../utils/SearchInput";

const MAX_RECENT_SEARCHES = 10;
const SECTION_LIMIT = 50; // only show 50 results per section for performance reasons
const AVATAR_SIZE = 24;

interface IProps {
    initialText?: string;
    initialFilter?: Filter;
    onFinished(): void;
}

function refIsForRecentlyViewed(ref?: RefObject<HTMLElement>): boolean {
    return ref?.current?.id?.startsWith("mx_SpotlightDialog_button_recentlyViewed_") === true;
}

function getRoomTypes(showRooms: boolean, showSpaces: boolean): Set<RoomType | null> {
    const roomTypes = new Set<RoomType | null>();

    if (showRooms) roomTypes.add(null);
    if (showSpaces) roomTypes.add(RoomType.Space);

    return roomTypes;
}

enum Section {
    People,
    Rooms,
    Spaces,
    Suggestions,
    PublicRooms,
}

export enum Filter {
    People,
    PublicRooms,
}

function filterToLabel(filter: Filter): string {
    switch (filter) {
        case Filter.People:
            return _t("People");
        case Filter.PublicRooms:
            return _t("Public rooms");
    }
}

interface IBaseResult {
    section: Section;
    filter: Filter[];
    query?: string[]; // extra fields to query match, stored as lowercase
}

interface IPublicRoomResult extends IBaseResult {
    publicRoom: IPublicRoomsChunkRoom;
}

interface IRoomResult extends IBaseResult {
    room: Room;
}

interface IMemberResult extends IBaseResult {
    member: Member | RoomMember;
}

interface IResult extends IBaseResult {
    avatar: JSX.Element;
    name: string;
    description?: string;
    onClick?(): void;
}

type Result = IRoomResult | IPublicRoomResult | IMemberResult | IResult;

const isRoomResult = (result: any): result is IRoomResult => !!result?.room;
const isPublicRoomResult = (result: any): result is IPublicRoomResult => !!result?.publicRoom;
const isMemberResult = (result: any): result is IMemberResult => !!result?.member;

const toPublicRoomResult = (publicRoom: IPublicRoomsChunkRoom): IPublicRoomResult => ({
    publicRoom,
    section: Section.PublicRooms,
    filter: [Filter.PublicRooms],
    query: filterBoolean([
        publicRoom.room_id.toLowerCase(),
        publicRoom.canonical_alias?.toLowerCase(),
        publicRoom.name?.toLowerCase(),
        sanitizeHtml(publicRoom.topic?.toLowerCase() ?? "", { allowedTags: [] }),
        ...(publicRoom.aliases?.map((it) => it.toLowerCase()) || []),
    ]),
});

const toRoomResult = (room: Room): IRoomResult => {
    const myUserId = MatrixClientPeg.get().getUserId();
    const otherUserId = DMRoomMap.shared().getUserIdForRoomId(room.roomId);

    if (otherUserId) {
        const otherMembers = room.getMembers().filter((it) => it.userId !== myUserId);
        const query = [
            ...otherMembers.map((it) => it.name.toLowerCase()),
            ...otherMembers.map((it) => it.userId.toLowerCase()),
        ].filter(Boolean);
        return {
            room,
            section: Section.People,
            filter: [Filter.People],
            query,
        };
    } else if (room.isSpaceRoom()) {
        return {
            room,
            section: Section.Spaces,
            filter: [],
        };
    } else {
        return {
            room,
            section: Section.Rooms,
            filter: [],
        };
    }
};

const toMemberResult = (member: Member | RoomMember): IMemberResult => ({
    member,
    section: Section.Suggestions,
    filter: [Filter.People],
    query: [member.userId.toLowerCase(), member.name.toLowerCase()].filter(Boolean),
});

const recentAlgorithm = new RecentAlgorithm();

export const useWebSearchMetrics = (numResults: number, queryLength: number, viaSpotlight: boolean): void => {
    useEffect(() => {
        if (!queryLength) return;

        // send metrics after a 1s debounce
        const timeoutId = window.setTimeout(() => {
            PosthogAnalytics.instance.trackEvent<WebSearchEvent>({
                eventName: "WebSearch",
                viaSpotlight,
                numResults,
                queryLength,
            });
        }, 1000);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [numResults, queryLength, viaSpotlight]);
};

const findVisibleRooms = (cli: MatrixClient, msc3946ProcessDynamicPredecessor: boolean): Room[] => {
    return cli.getVisibleRooms(msc3946ProcessDynamicPredecessor).filter((room) => {
        // Do not show local rooms
        if (isLocalRoom(room)) return false;

        // TODO we may want to put invites in their own list
        return room.getMyMembership() === "join" || room.getMyMembership() == "invite";
    });
};

const findVisibleRoomMembers = (
    cli: MatrixClient,
    msc3946ProcessDynamicPredecessor: boolean,
    filterDMs = true,
): RoomMember[] => {
    return Object.values(
        findVisibleRooms(cli, msc3946ProcessDynamicPredecessor)
            .filter((room) => !filterDMs || !DMRoomMap.shared().getUserIdForRoomId(room.roomId))
            .reduce((members, room) => {
                for (const member of room.getJoinedMembers()) {
                    members[member.userId] = member;
                }
                return members;
            }, {} as Record<string, RoomMember>),
    ).filter((it) => it.userId !== cli.getUserId());
};

const roomAriaUnreadLabel = (room: Room, notification: RoomNotificationState): string | undefined => {
    if (notification.hasMentions) {
        return _t("%(count)s unread messages including mentions.", {
            count: notification.count,
        });
    } else if (notification.hasUnreadCount) {
        return _t("%(count)s unread messages.", {
            count: notification.count,
        });
    } else if (notification.isUnread) {
        return _t("Unread messages.");
    } else {
        return undefined;
    }
};

interface IDirectoryOpts {
    limit: number;
    query: string;
}

const SpotlightDialog: React.FC<IProps> = ({ initialText = "", initialFilter = null, onFinished }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const cli = MatrixClientPeg.get();
    const rovingContext = useContext(RovingTabIndexContext);
    const [query, _setQuery] = useState(initialText);
    const [recentSearches, clearRecentSearches] = useRecentSearches();
    const [filter, setFilterInternal] = useState<Filter | null>(initialFilter);
    const setFilter = useCallback((filter: Filter | null) => {
        setFilterInternal(filter);
        inputRef.current?.focus();
        scrollContainerRef.current?.scrollTo?.({ top: 0 });
    }, []);
    const memberComparator = useMemo(() => {
        const activityScores = buildActivityScores(cli);
        const memberScores = buildMemberScores(cli);
        return compareMembers(activityScores, memberScores);
    }, [cli]);
    const msc3946ProcessDynamicPredecessor = useFeatureEnabled("feature_dynamic_room_predecessors");

    const ownInviteLink = makeUserPermalink(cli.getUserId()!);
    const [inviteLinkCopied, setInviteLinkCopied] = useState<boolean>(false);
    const trimmedQuery = useMemo(() => query.trim(), [query]);

    const exploringPublicSpacesEnabled = useFeatureEnabled("feature_exploring_public_spaces");

    const {
        loading: publicRoomsLoading,
        publicRooms,
        protocols,
        config,
        setConfig,
        search: searchPublicRooms,
    } = usePublicRoomDirectory();
    const [showRooms, setShowRooms] = useState(true);
    const [showSpaces, setShowSpaces] = useState(false);
    const { loading: peopleLoading, users, search: searchPeople } = useUserDirectory();
    const { loading: profileLoading, profile, search: searchProfileInfo } = useProfileInfo();
    const searchParams: [IDirectoryOpts] = useMemo(
        () => [
            {
                query: trimmedQuery,
                roomTypes: getRoomTypes(showRooms, showSpaces),
                limit: SECTION_LIMIT,
            },
        ],
        [trimmedQuery, showRooms, showSpaces],
    );
    useDebouncedCallback(filter === Filter.PublicRooms, searchPublicRooms, searchParams);
    useDebouncedCallback(filter === Filter.People, searchPeople, searchParams);
    useDebouncedCallback(filter === Filter.People, searchProfileInfo, searchParams);

    const possibleResults = useMemo<Result[]>(() => {
        const userResults: IMemberResult[] = [];
        const roomResults = findVisibleRooms(cli, msc3946ProcessDynamicPredecessor).map(toRoomResult);
        // If we already have a DM with the user we're looking for, we will
        // show that DM instead of the user themselves
        const alreadyAddedUserIds = roomResults.reduce((userIds, result) => {
            const userId = DMRoomMap.shared().getUserIdForRoomId(result.room.roomId);
            if (!userId) return userIds;
            if (result.room.getJoinedMemberCount() > 2) return userIds;
            userIds.add(userId);
            return userIds;
        }, new Set<string>());
        for (const user of [...findVisibleRoomMembers(cli, msc3946ProcessDynamicPredecessor), ...users]) {
            // Make sure we don't have any user more than once
            if (alreadyAddedUserIds.has(user.userId)) continue;
            alreadyAddedUserIds.add(user.userId);

            userResults.push(toMemberResult(user));
        }

        return [
            ...SpaceStore.instance.enabledMetaSpaces.map((spaceKey) => ({
                section: Section.Spaces,
                filter: [] as Filter[],
                avatar: (
                    <div
                        className={classNames(
                            "mx_SpotlightDialog_metaspaceResult",
                            `mx_SpotlightDialog_metaspaceResult_${spaceKey}`,
                        )}
                    />
                ),
                name: getMetaSpaceName(spaceKey, SpaceStore.instance.allRoomsInHome),
                onClick() {
                    SpaceStore.instance.setActiveSpace(spaceKey);
                },
            })),
            ...roomResults,
            ...userResults,
            ...(profile && !alreadyAddedUserIds.has(profile.user_id) ? [new DirectoryMember(profile)] : []).map(
                toMemberResult,
            ),
            ...publicRooms.map(toPublicRoomResult),
        ].filter((result) => filter === null || result.filter.includes(filter));
    }, [cli, users, profile, publicRooms, filter, msc3946ProcessDynamicPredecessor]);

    const results = useMemo<Record<Section, Result[]>>(() => {
        const results: Record<Section, Result[]> = {
            [Section.People]: [],
            [Section.Rooms]: [],
            [Section.Spaces]: [],
            [Section.Suggestions]: [],
            [Section.PublicRooms]: [],
        };

        // Group results in their respective sections
        if (trimmedQuery) {
            const lcQuery = trimmedQuery.toLowerCase();
            const normalizedQuery = normalize(trimmedQuery);

            possibleResults.forEach((entry) => {
                if (isRoomResult(entry)) {
                    if (
                        !entry.room.normalizedName?.includes(normalizedQuery) &&
                        !entry.room.getCanonicalAlias()?.toLowerCase().includes(lcQuery) &&
                        !entry.query?.some((q) => q.includes(lcQuery))
                    )
                        return; // bail, does not match query
                } else if (isMemberResult(entry)) {
                    if (!entry.query?.some((q) => q.includes(lcQuery))) return; // bail, does not match query
                } else if (isPublicRoomResult(entry)) {
                    if (!entry.query?.some((q) => q.includes(lcQuery))) return; // bail, does not match query
                } else {
                    if (!entry.name.toLowerCase().includes(lcQuery) && !entry.query?.some((q) => q.includes(lcQuery)))
                        return; // bail, does not match query
                }

                results[entry.section].push(entry);
            });
        } else if (filter === Filter.PublicRooms) {
            // return all results for public rooms if no query is given
            possibleResults.forEach((entry) => {
                if (isPublicRoomResult(entry)) {
                    results[entry.section].push(entry);
                }
            });
        } else if (filter === Filter.People) {
            // return all results for people if no query is given
            possibleResults.forEach((entry) => {
                if (isMemberResult(entry)) {
                    results[entry.section].push(entry);
                }
            });
        }

        // Sort results by most recent activity

        const myUserId = cli.getSafeUserId();
        for (const resultArray of Object.values(results)) {
            resultArray.sort((a: Result, b: Result) => {
                if (isRoomResult(a) || isRoomResult(b)) {
                    // Room results should appear at the top of the list
                    if (!isRoomResult(b)) return -1;
                    if (!isRoomResult(a)) return -1;

                    return recentAlgorithm.getLastTs(b.room, myUserId) - recentAlgorithm.getLastTs(a.room, myUserId);
                } else if (isMemberResult(a) || isMemberResult(b)) {
                    // Member results should appear just after room results
                    if (!isMemberResult(b)) return -1;
                    if (!isMemberResult(a)) return -1;

                    return memberComparator(a.member, b.member);
                }
                return 0;
            });
        }

        return results;
    }, [trimmedQuery, filter, cli, possibleResults, memberComparator]);

    const numResults = sum(Object.values(results).map((it) => it.length));
    useWebSearchMetrics(numResults, query.length, true);

    const activeSpace = SpaceStore.instance.activeSpaceRoom;
    const [spaceResults, spaceResultsLoading] = useSpaceResults(activeSpace ?? undefined, query);

    const setQuery = (e: ChangeEvent<HTMLInputElement>): void => {
        const newQuery = transformSearchTerm(e.currentTarget.value);
        _setQuery(newQuery);
    };
    useEffect(() => {
        setImmediate(() => {
            const ref = rovingContext.state.refs[0];
            if (ref) {
                rovingContext.dispatch({
                    type: Type.SetFocus,
                    payload: { ref },
                });
                ref.current?.scrollIntoView?.({
                    block: "nearest",
                });
            }
        });
        // we intentionally ignore changes to the rovingContext for the purpose of this hook
        // we only want to reset the focus whenever the results or filters change
        // eslint-disable-next-line
    }, [results, filter]);

    const viewRoom = (
        room: { roomId: string; roomAlias?: string; autoJoin?: boolean; shouldPeek?: boolean; viaServers?: string[] },
        persist = false,
        viaKeyboard = false,
    ): void => {
        if (persist) {
            const recents = new Set(SettingsStore.getValue("SpotlightSearch.recentSearches", null).reverse());
            // remove & add the room to put it at the end
            recents.delete(room.roomId);
            recents.add(room.roomId);

            SettingsStore.setValue(
                "SpotlightSearch.recentSearches",
                null,
                SettingLevel.ACCOUNT,
                Array.from(recents).reverse().slice(0, MAX_RECENT_SEARCHES),
            );
        }

        defaultDispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            metricsTrigger: "WebUnifiedSearch",
            metricsViaKeyboard: viaKeyboard,
            room_id: room.roomId,
            room_alias: room.roomAlias,
            auto_join: room.autoJoin,
            should_peek: room.shouldPeek,
            via_servers: room.viaServers,
        });
        onFinished();
    };

    let otherSearchesSection: JSX.Element | undefined;
    if (trimmedQuery || filter !== Filter.PublicRooms) {
        otherSearchesSection = (
            <div
                className="mx_SpotlightDialog_section mx_SpotlightDialog_otherSearches"
                role="group"
                aria-labelledby="mx_SpotlightDialog_section_otherSearches"
            >
                <h4 id="mx_SpotlightDialog_section_otherSearches">
                    {trimmedQuery ? _t('Use "%(query)s" to search', { query }) : _t("Search for")}
                </h4>
                <div>
                    {filter !== Filter.PublicRooms && (
                        <Option
                            id="mx_SpotlightDialog_button_explorePublicRooms"
                            className="mx_SpotlightDialog_explorePublicRooms"
                            onClick={() => setFilter(Filter.PublicRooms)}
                        >
                            {filterToLabel(Filter.PublicRooms)}
                        </Option>
                    )}
                    {filter !== Filter.People && (
                        <Option
                            id="mx_SpotlightDialog_button_startChat"
                            className="mx_SpotlightDialog_startChat"
                            onClick={() => setFilter(Filter.People)}
                        >
                            {filterToLabel(Filter.People)}
                        </Option>
                    )}
                </div>
            </div>
        );
    }

    let content: JSX.Element;
    if (trimmedQuery || filter !== null) {
        const resultMapper = (result: Result): JSX.Element => {
            if (isRoomResult(result)) {
                const notification = RoomNotificationStateStore.instance.getRoomState(result.room);
                const unreadLabel = roomAriaUnreadLabel(result.room, notification);
                const ariaProperties = {
                    "aria-label": unreadLabel ? `${result.room.name} ${unreadLabel}` : result.room.name,
                    "aria-describedby": `mx_SpotlightDialog_button_result_${result.room.roomId}_details`,
                };
                return (
                    <Option
                        id={`mx_SpotlightDialog_button_result_${result.room.roomId}`}
                        key={`${Section[result.section]}-${result.room.roomId}`}
                        onClick={(ev) => {
                            viewRoom({ roomId: result.room.roomId }, true, ev?.type !== "click");
                        }}
                        endAdornment={<RoomResultContextMenus room={result.room} />}
                        {...ariaProperties}
                    >
                        <DecoratedRoomAvatar
                            room={result.room}
                            avatarSize={AVATAR_SIZE}
                            tooltipProps={{ tabIndex: -1 }}
                        />
                        {result.room.name}
                        <NotificationBadge notification={notification} />
                        <RoomContextDetails
                            id={`mx_SpotlightDialog_button_result_${result.room.roomId}_details`}
                            className="mx_SpotlightDialog_result_details"
                            room={result.room}
                        />
                    </Option>
                );
            }
            if (isMemberResult(result)) {
                return (
                    <Option
                        id={`mx_SpotlightDialog_button_result_${result.member.userId}`}
                        key={`${Section[result.section]}-${result.member.userId}`}
                        onClick={() => {
                            startDmOnFirstMessage(cli, [result.member]);
                            onFinished();
                        }}
                        aria-label={
                            result.member instanceof RoomMember ? result.member.rawDisplayName : result.member.name
                        }
                        aria-describedby={`mx_SpotlightDialog_button_result_${result.member.userId}_details`}
                    >
                        <SearchResultAvatar user={result.member} size={AVATAR_SIZE} />
                        {result.member instanceof RoomMember ? result.member.rawDisplayName : result.member.name}
                        <div
                            id={`mx_SpotlightDialog_button_result_${result.member.userId}_details`}
                            className="mx_SpotlightDialog_result_details"
                        >
                            {result.member.userId}
                        </div>
                    </Option>
                );
            }
            if (isPublicRoomResult(result)) {
                const clientRoom = cli.getRoom(result.publicRoom.room_id);
                // Element Web currently does not allow guests to join rooms, so we
                // instead show them view buttons for all rooms. If the room is not
                // world readable, a modal will appear asking you to register first. If
                // it is readable, the preview appears as normal.
                const showViewButton =
                    clientRoom?.getMyMembership() === "join" || result.publicRoom.world_readable || cli.isGuest();

                const listener = (ev: ButtonEvent): void => {
                    ev.stopPropagation();

                    const { publicRoom } = result;
                    viewRoom(
                        {
                            roomAlias: publicRoom.canonical_alias || publicRoom.aliases?.[0],
                            roomId: publicRoom.room_id,
                            autoJoin: !result.publicRoom.world_readable && !cli.isGuest(),
                            shouldPeek: result.publicRoom.world_readable || cli.isGuest(),
                            viaServers: config ? [config.roomServer] : undefined,
                        },
                        true,
                        ev.type !== "click",
                    );
                };

                return (
                    <Option
                        id={`mx_SpotlightDialog_button_result_${result.publicRoom.room_id}`}
                        className="mx_SpotlightDialog_result_multiline"
                        key={`${Section[result.section]}-${result.publicRoom.room_id}`}
                        onClick={listener}
                        endAdornment={
                            <AccessibleButton
                                kind={showViewButton ? "primary_outline" : "primary"}
                                onClick={listener}
                                tabIndex={-1}
                            >
                                {showViewButton ? _t("View") : _t("Join")}
                            </AccessibleButton>
                        }
                        aria-labelledby={`mx_SpotlightDialog_button_result_${result.publicRoom.room_id}_name`}
                        aria-describedby={`mx_SpotlightDialog_button_result_${result.publicRoom.room_id}_alias`}
                        aria-details={`mx_SpotlightDialog_button_result_${result.publicRoom.room_id}_details`}
                    >
                        <RoomAvatar
                            className="mx_SearchResultAvatar"
                            oobData={{
                                roomId: result.publicRoom.room_id,
                                name: result.publicRoom.name,
                                avatarUrl: result.publicRoom.avatar_url,
                                roomType: result.publicRoom.room_type,
                            }}
                            width={AVATAR_SIZE}
                            height={AVATAR_SIZE}
                        />
                        <PublicRoomResultDetails
                            room={result.publicRoom}
                            labelId={`mx_SpotlightDialog_button_result_${result.publicRoom.room_id}_name`}
                            descriptionId={`mx_SpotlightDialog_button_result_${result.publicRoom.room_id}_alias`}
                            detailsId={`mx_SpotlightDialog_button_result_${result.publicRoom.room_id}_details`}
                        />
                    </Option>
                );
            }

            // IResult case
            return (
                <Option
                    id={`mx_SpotlightDialog_button_result_${result.name}`}
                    key={`${Section[result.section]}-${result.name}`}
                    onClick={result.onClick ?? null}
                >
                    {result.avatar}
                    {result.name}
                    {result.description}
                </Option>
            );
        };

        let peopleSection: JSX.Element | undefined;
        if (results[Section.People].length) {
            peopleSection = (
                <div
                    className="mx_SpotlightDialog_section mx_SpotlightDialog_results"
                    role="group"
                    aria-labelledby="mx_SpotlightDialog_section_people"
                >
                    <h4 id="mx_SpotlightDialog_section_people">{_t("Recent Conversations")}</h4>
                    <div>{results[Section.People].slice(0, SECTION_LIMIT).map(resultMapper)}</div>
                </div>
            );
        }

        let suggestionsSection: JSX.Element | undefined;
        if (results[Section.Suggestions].length && filter === Filter.People) {
            suggestionsSection = (
                <div
                    className="mx_SpotlightDialog_section mx_SpotlightDialog_results"
                    role="group"
                    aria-labelledby="mx_SpotlightDialog_section_suggestions"
                >
                    <h4 id="mx_SpotlightDialog_section_suggestions">{_t("Suggestions")}</h4>
                    <div>{results[Section.Suggestions].slice(0, SECTION_LIMIT).map(resultMapper)}</div>
                </div>
            );
        }

        let roomsSection: JSX.Element | undefined;
        if (results[Section.Rooms].length) {
            roomsSection = (
                <div
                    className="mx_SpotlightDialog_section mx_SpotlightDialog_results"
                    role="group"
                    aria-labelledby="mx_SpotlightDialog_section_rooms"
                >
                    <h4 id="mx_SpotlightDialog_section_rooms">{_t("Rooms")}</h4>
                    <div>{results[Section.Rooms].slice(0, SECTION_LIMIT).map(resultMapper)}</div>
                </div>
            );
        }

        let spacesSection: JSX.Element | undefined;
        if (results[Section.Spaces].length) {
            spacesSection = (
                <div
                    className="mx_SpotlightDialog_section mx_SpotlightDialog_results"
                    role="group"
                    aria-labelledby="mx_SpotlightDialog_section_spaces"
                >
                    <h4 id="mx_SpotlightDialog_section_spaces">{_t("Spaces you're in")}</h4>
                    <div>{results[Section.Spaces].slice(0, SECTION_LIMIT).map(resultMapper)}</div>
                </div>
            );
        }

        let publicRoomsSection: JSX.Element | undefined;
        if (filter === Filter.PublicRooms) {
            publicRoomsSection = (
                <div
                    className="mx_SpotlightDialog_section mx_SpotlightDialog_results"
                    role="group"
                    aria-labelledby="mx_SpotlightDialog_section_publicRooms"
                >
                    <div className="mx_SpotlightDialog_sectionHeader">
                        <h4 id="mx_SpotlightDialog_section_publicRooms">{_t("Suggestions")}</h4>
                        <div className="mx_SpotlightDialog_options">
                            {exploringPublicSpacesEnabled && (
                                <>
                                    <LabelledCheckbox
                                        label={_t("Show rooms")}
                                        value={showRooms}
                                        onChange={setShowRooms}
                                    />
                                    <LabelledCheckbox
                                        label={_t("Show spaces")}
                                        value={showSpaces}
                                        onChange={setShowSpaces}
                                    />
                                </>
                            )}
                            <NetworkDropdown protocols={protocols} config={config ?? null} setConfig={setConfig} />
                        </div>
                    </div>
                    <div>
                        {" "}
                        {showRooms || showSpaces ? (
                            results[Section.PublicRooms].slice(0, SECTION_LIMIT).map(resultMapper)
                        ) : (
                            <div className="mx_SpotlightDialog_otherSearches_messageSearchText">
                                {_t("You cannot search for rooms that are neither a room nor a space")}
                            </div>
                        )}{" "}
                    </div>
                </div>
            );
        }

        let spaceRoomsSection: JSX.Element | undefined;
        if (spaceResults.length && activeSpace && filter === null) {
            spaceRoomsSection = (
                <div
                    className="mx_SpotlightDialog_section mx_SpotlightDialog_results"
                    role="group"
                    aria-labelledby="mx_SpotlightDialog_section_spaceRooms"
                >
                    <h4 id="mx_SpotlightDialog_section_spaceRooms">
                        {_t("Other rooms in %(spaceName)s", { spaceName: activeSpace.name })}
                    </h4>
                    <div>
                        {spaceResults.slice(0, SECTION_LIMIT).map(
                            (room: IHierarchyRoom): JSX.Element => (
                                <Option
                                    id={`mx_SpotlightDialog_button_result_${room.room_id}`}
                                    key={room.room_id}
                                    onClick={(ev) => {
                                        viewRoom({ roomId: room.room_id }, true, ev?.type !== "click");
                                    }}
                                >
                                    <BaseAvatar
                                        name={room.name}
                                        idName={room.room_id}
                                        url={
                                            room.avatar_url
                                                ? mediaFromMxc(room.avatar_url).getSquareThumbnailHttp(AVATAR_SIZE)
                                                : null
                                        }
                                        width={AVATAR_SIZE}
                                        height={AVATAR_SIZE}
                                    />
                                    {room.name || room.canonical_alias}
                                    {room.name && room.canonical_alias && (
                                        <div className="mx_SpotlightDialog_result_details">{room.canonical_alias}</div>
                                    )}
                                </Option>
                            ),
                        )}
                        {spaceResultsLoading && <Spinner />}
                    </div>
                </div>
            );
        }

        let joinRoomSection: JSX.Element | undefined;
        if (
            trimmedQuery.startsWith("#") &&
            trimmedQuery.includes(":") &&
            (!getCachedRoomIDForAlias(trimmedQuery) || !cli.getRoom(getCachedRoomIDForAlias(trimmedQuery)))
        ) {
            joinRoomSection = (
                <div className="mx_SpotlightDialog_section mx_SpotlightDialog_otherSearches" role="group">
                    <div>
                        <Option
                            id="mx_SpotlightDialog_button_joinRoomAlias"
                            className="mx_SpotlightDialog_joinRoomAlias"
                            onClick={(ev) => {
                                defaultDispatcher.dispatch<ViewRoomPayload>({
                                    action: Action.ViewRoom,
                                    room_alias: trimmedQuery,
                                    auto_join: true,
                                    metricsTrigger: "WebUnifiedSearch",
                                    metricsViaKeyboard: ev?.type !== "click",
                                });
                                onFinished();
                            }}
                        >
                            {_t("Join %(roomAddress)s", {
                                roomAddress: trimmedQuery,
                            })}
                        </Option>
                    </div>
                </div>
            );
        }

        let hiddenResultsSection: JSX.Element | undefined;
        if (filter === Filter.People) {
            hiddenResultsSection = (
                <div className="mx_SpotlightDialog_section mx_SpotlightDialog_hiddenResults" role="group">
                    <h4>{_t("Some results may be hidden for privacy")}</h4>
                    <div className="mx_SpotlightDialog_otherSearches_messageSearchText">
                        {_t("If you can't see who you're looking for, send them your invite link.")}
                    </div>
                    <TooltipOption
                        id="mx_SpotlightDialog_button_inviteLink"
                        className="mx_SpotlightDialog_inviteLink"
                        onClick={() => {
                            setInviteLinkCopied(true);
                            copyPlaintext(ownInviteLink);
                        }}
                        onHideTooltip={() => setInviteLinkCopied(false)}
                        title={inviteLinkCopied ? _t("Copied!") : _t("Copy")}
                    >
                        <span className="mx_AccessibleButton mx_AccessibleButton_hasKind mx_AccessibleButton_kind_primary_outline">
                            {_t("Copy invite link")}
                        </span>
                    </TooltipOption>
                </div>
            );
        } else if (trimmedQuery && filter === Filter.PublicRooms) {
            hiddenResultsSection = (
                <div className="mx_SpotlightDialog_section mx_SpotlightDialog_hiddenResults" role="group">
                    <h4>{_t("Some results may be hidden")}</h4>
                    <div className="mx_SpotlightDialog_otherSearches_messageSearchText">
                        {_t(
                            "If you can't find the room you're looking for, " +
                                "ask for an invite or create a new room.",
                        )}
                    </div>
                    <Option
                        id="mx_SpotlightDialog_button_createNewRoom"
                        className="mx_SpotlightDialog_createRoom"
                        onClick={() =>
                            defaultDispatcher.dispatch({
                                action: "view_create_room",
                                public: true,
                                defaultName: capitalize(trimmedQuery),
                            })
                        }
                    >
                        <span className="mx_AccessibleButton mx_AccessibleButton_hasKind mx_AccessibleButton_kind_primary_outline">
                            {_t("Create new room")}
                        </span>
                    </Option>
                </div>
            );
        }

        let groupChatSection: JSX.Element | undefined;
        if (filter === Filter.People) {
            groupChatSection = (
                <div
                    className="mx_SpotlightDialog_section mx_SpotlightDialog_otherSearches"
                    role="group"
                    aria-labelledby="mx_SpotlightDialog_section_groupChat"
                >
                    <h4 id="mx_SpotlightDialog_section_groupChat">{_t("Other options")}</h4>
                    <Option
                        id="mx_SpotlightDialog_button_startGroupChat"
                        className="mx_SpotlightDialog_startGroupChat"
                        onClick={() => showStartChatInviteDialog(trimmedQuery)}
                    >
                        {_t("Start a group chat")}
                    </Option>
                </div>
            );
        }

        let messageSearchSection: JSX.Element | undefined;
        if (filter === null) {
            messageSearchSection = (
                <div
                    className="mx_SpotlightDialog_section mx_SpotlightDialog_otherSearches"
                    role="group"
                    aria-labelledby="mx_SpotlightDialog_section_messageSearch"
                >
                    <h4 id="mx_SpotlightDialog_section_messageSearch">{_t("Other searches")}</h4>
                    <div className="mx_SpotlightDialog_otherSearches_messageSearchText">
                        {_t(
                            "To search messages, look for this icon at the top of a room <icon/>",
                            {},
                            { icon: () => <div className="mx_SpotlightDialog_otherSearches_messageSearchIcon" /> },
                        )}
                    </div>
                </div>
            );
        }

        content = (
            <>
                {peopleSection}
                {suggestionsSection}
                {roomsSection}
                {spacesSection}
                {spaceRoomsSection}
                {publicRoomsSection}
                {joinRoomSection}
                {hiddenResultsSection}
                {otherSearchesSection}
                {groupChatSection}
                {messageSearchSection}
            </>
        );
    } else {
        let recentSearchesSection: JSX.Element | undefined;
        if (recentSearches.length) {
            recentSearchesSection = (
                <div
                    className="mx_SpotlightDialog_section mx_SpotlightDialog_recentSearches"
                    role="group"
                    // Firefox sometimes makes this element focusable due to overflow,
                    // so force it out of tab order by default.
                    tabIndex={-1}
                    aria-labelledby="mx_SpotlightDialog_section_recentSearches"
                >
                    <h4>
                        <span id="mx_SpotlightDialog_section_recentSearches">{_t("Recent searches")}</span>
                        <AccessibleButton kind="link" onClick={clearRecentSearches}>
                            {_t("Clear")}
                        </AccessibleButton>
                    </h4>
                    <div>
                        {recentSearches.map((room) => {
                            const notification = RoomNotificationStateStore.instance.getRoomState(room);
                            const unreadLabel = roomAriaUnreadLabel(room, notification);
                            const ariaProperties = {
                                "aria-label": unreadLabel ? `${room.name} ${unreadLabel}` : room.name,
                                "aria-describedby": `mx_SpotlightDialog_button_recentSearch_${room.roomId}_details`,
                            };
                            return (
                                <Option
                                    id={`mx_SpotlightDialog_button_recentSearch_${room.roomId}`}
                                    key={room.roomId}
                                    onClick={(ev) => {
                                        viewRoom({ roomId: room.roomId }, true, ev?.type !== "click");
                                    }}
                                    endAdornment={<RoomResultContextMenus room={room} />}
                                    {...ariaProperties}
                                >
                                    <DecoratedRoomAvatar
                                        room={room}
                                        avatarSize={AVATAR_SIZE}
                                        tooltipProps={{ tabIndex: -1 }}
                                    />
                                    {room.name}
                                    <NotificationBadge notification={notification} />
                                    <RoomContextDetails
                                        id={`mx_SpotlightDialog_button_recentSearch_${room.roomId}_details`}
                                        className="mx_SpotlightDialog_result_details"
                                        room={room}
                                    />
                                </Option>
                            );
                        })}
                    </div>
                </div>
            );
        }

        content = (
            <>
                <div
                    className="mx_SpotlightDialog_section mx_SpotlightDialog_recentlyViewed"
                    role="group"
                    aria-labelledby="mx_SpotlightDialog_section_recentlyViewed"
                >
                    <h4 id="mx_SpotlightDialog_section_recentlyViewed">{_t("Recently viewed")}</h4>
                    <div>
                        {BreadcrumbsStore.instance.rooms
                            .filter((r) => r.roomId !== SdkContextClass.instance.roomViewStore.getRoomId())
                            .map((room) => (
                                <TooltipOption
                                    id={`mx_SpotlightDialog_button_recentlyViewed_${room.roomId}`}
                                    title={room.name}
                                    key={room.roomId}
                                    onClick={(ev) => {
                                        viewRoom({ roomId: room.roomId }, false, ev.type !== "click");
                                    }}
                                >
                                    <DecoratedRoomAvatar room={room} avatarSize={32} tooltipProps={{ tabIndex: -1 }} />
                                    {room.name}
                                </TooltipOption>
                            ))}
                    </div>
                </div>

                {recentSearchesSection}
                {otherSearchesSection}
            </>
        );
    }

    const onDialogKeyDown = (ev: KeyboardEvent | React.KeyboardEvent): void => {
        const navigationAction = getKeyBindingsManager().getNavigationAction(ev);
        switch (navigationAction) {
            case KeyBindingAction.FilterRooms:
                ev.stopPropagation();
                ev.preventDefault();
                onFinished();
                break;
        }

        let ref: RefObject<HTMLElement> | undefined;
        const accessibilityAction = getKeyBindingsManager().getAccessibilityAction(ev);
        switch (accessibilityAction) {
            case KeyBindingAction.Escape:
                ev.stopPropagation();
                ev.preventDefault();
                onFinished();
                break;
            case KeyBindingAction.ArrowUp:
            case KeyBindingAction.ArrowDown:
                ev.stopPropagation();
                ev.preventDefault();

                if (rovingContext.state.activeRef && rovingContext.state.refs.length > 0) {
                    let refs = rovingContext.state.refs;
                    if (!query && !filter !== null) {
                        // If the current selection is not in the recently viewed row then only include the
                        // first recently viewed so that is the target when the user is switching into recently viewed.
                        const keptRecentlyViewedRef = refIsForRecentlyViewed(rovingContext.state.activeRef)
                            ? rovingContext.state.activeRef
                            : refs.find(refIsForRecentlyViewed);
                        // exclude all other recently viewed items from the list so up/down arrows skip them
                        refs = refs.filter((ref) => ref === keptRecentlyViewedRef || !refIsForRecentlyViewed(ref));
                    }

                    const idx = refs.indexOf(rovingContext.state.activeRef);
                    ref = findSiblingElement(refs, idx + (accessibilityAction === KeyBindingAction.ArrowUp ? -1 : 1));
                }
                break;

            case KeyBindingAction.ArrowLeft:
            case KeyBindingAction.ArrowRight:
                // only handle these keys when we are in the recently viewed row of options
                if (
                    !query &&
                    !filter !== null &&
                    rovingContext.state.activeRef &&
                    rovingContext.state.refs.length > 0 &&
                    refIsForRecentlyViewed(rovingContext.state.activeRef)
                ) {
                    // we only intercept left/right arrows when the field is empty, and they'd do nothing anyway
                    ev.stopPropagation();
                    ev.preventDefault();

                    const refs = rovingContext.state.refs.filter(refIsForRecentlyViewed);
                    const idx = refs.indexOf(rovingContext.state.activeRef);
                    ref = findSiblingElement(refs, idx + (accessibilityAction === KeyBindingAction.ArrowLeft ? -1 : 1));
                }
                break;
        }

        if (ref) {
            rovingContext.dispatch({
                type: Type.SetFocus,
                payload: { ref },
            });
            ref.current?.scrollIntoView({
                block: "nearest",
            });
        }
    };

    const onKeyDown = (ev: React.KeyboardEvent): void => {
        const action = getKeyBindingsManager().getAccessibilityAction(ev);

        switch (action) {
            case KeyBindingAction.Backspace:
                if (!query && filter !== null) {
                    ev.stopPropagation();
                    ev.preventDefault();
                    setFilter(null);
                }
                break;
            case KeyBindingAction.Enter:
                ev.stopPropagation();
                ev.preventDefault();
                rovingContext.state.activeRef?.current?.click();
                break;
        }
    };

    const activeDescendant = rovingContext.state.activeRef?.current?.id;

    return (
        <>
            <div id="mx_SpotlightDialog_keyboardPrompt">
                {_t(
                    "Use <arrows/> to scroll",
                    {},
                    {
                        arrows: () => (
                            <>
                                <kbd>↓</kbd>
                                <kbd>↑</kbd>
                                {!filter !== null && !query && <kbd>←</kbd>}
                                {!filter !== null && !query && <kbd>→</kbd>}
                            </>
                        ),
                    },
                )}
            </div>

            <BaseDialog
                className="mx_SpotlightDialog"
                onFinished={onFinished}
                hasCancel={false}
                onKeyDown={onDialogKeyDown}
                screenName="UnifiedSearch"
                aria-label={_t("Search Dialog")}
            >
                <div className="mx_SpotlightDialog_searchBox mx_textinput">
                    {filter !== null && (
                        <div
                            className={classNames("mx_SpotlightDialog_filter", {
                                mx_SpotlightDialog_filterPeople: filter === Filter.People,
                                mx_SpotlightDialog_filterPublicRooms: filter === Filter.PublicRooms,
                            })}
                        >
                            <span>{filterToLabel(filter)}</span>
                            <AccessibleButton
                                tabIndex={-1}
                                alt={_t("Remove search filter for %(filter)s", {
                                    filter: filterToLabel(filter),
                                })}
                                className="mx_SpotlightDialog_filter--close"
                                onClick={() => setFilter(null)}
                            />
                        </div>
                    )}
                    <input
                        ref={inputRef}
                        autoFocus
                        type="text"
                        autoComplete="off"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck="false"
                        placeholder={_t("Search")}
                        value={query}
                        onChange={setQuery}
                        onKeyDown={onKeyDown}
                        aria-owns="mx_SpotlightDialog_content"
                        aria-activedescendant={activeDescendant}
                        aria-label={_t("Search")}
                        aria-describedby="mx_SpotlightDialog_keyboardPrompt"
                    />
                    {(publicRoomsLoading || peopleLoading || profileLoading) && <Spinner w={24} h={24} />}
                </div>

                <div
                    ref={scrollContainerRef}
                    id="mx_SpotlightDialog_content"
                    role="listbox"
                    aria-activedescendant={activeDescendant}
                    aria-describedby="mx_SpotlightDialog_keyboardPrompt"
                >
                    {content}
                </div>
            </BaseDialog>
        </>
    );
};

const RovingSpotlightDialog: React.FC<IProps> = (props) => {
    return <RovingTabIndexProvider>{() => <SpotlightDialog {...props} />}</RovingTabIndexProvider>;
};

export default RovingSpotlightDialog;
