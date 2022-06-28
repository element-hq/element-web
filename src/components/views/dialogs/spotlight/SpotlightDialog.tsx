/*
Copyright 2021-2022 The Matrix.org Foundation C.I.C.

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

import classNames from "classnames";
import { capitalize, sum } from "lodash";
import { WebSearch as WebSearchEvent } from "@matrix-org/analytics-events/types/typescript/WebSearch";
import { IHierarchyRoom } from "matrix-js-sdk/src/@types/spaces";
import { IPublicRoomsChunkRoom, MatrixClient, RoomMember, RoomType } from "matrix-js-sdk/src/matrix";
import { Room } from "matrix-js-sdk/src/models/room";
import { normalize } from "matrix-js-sdk/src/utils";
import React, {
    ChangeEvent,
    KeyboardEvent,
    RefObject,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import sanitizeHtml from "sanitize-html";

import { KeyBindingAction } from "../../../../accessibility/KeyboardShortcuts";
import { Ref } from "../../../../accessibility/roving/types";
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
import Modal from "../../../../Modal";
import { PosthogAnalytics } from "../../../../PosthogAnalytics";
import { getCachedRoomIDForAlias } from "../../../../RoomAliasCache";
import { showStartChatInviteDialog } from "../../../../RoomInvite";
import SdkConfig from "../../../../SdkConfig";
import { SettingLevel } from "../../../../settings/SettingLevel";
import SettingsStore from "../../../../settings/SettingsStore";
import { BreadcrumbsStore } from "../../../../stores/BreadcrumbsStore";
import { RoomNotificationStateStore } from "../../../../stores/notifications/RoomNotificationStateStore";
import { RecentAlgorithm } from "../../../../stores/room-list/algorithms/tag-sorting/RecentAlgorithm";
import { RoomViewStore } from "../../../../stores/RoomViewStore";
import { getMetaSpaceName } from "../../../../stores/spaces";
import SpaceStore from "../../../../stores/spaces/SpaceStore";
import { DirectoryMember, Member, startDm } from "../../../../utils/direct-messages";
import DMRoomMap from "../../../../utils/DMRoomMap";
import { makeUserPermalink } from "../../../../utils/permalinks/Permalinks";
import { buildActivityScores, buildMemberScores, compareMembers } from "../../../../utils/SortMembers";
import { copyPlaintext } from "../../../../utils/strings";
import BaseAvatar from "../../avatars/BaseAvatar";
import DecoratedRoomAvatar from "../../avatars/DecoratedRoomAvatar";
import { SearchResultAvatar } from "../../avatars/SearchResultAvatar";
import { NetworkDropdown } from "../../directory/NetworkDropdown";
import AccessibleButton from "../../elements/AccessibleButton";
import Spinner from "../../elements/Spinner";
import NotificationBadge from "../../rooms/NotificationBadge";
import BaseDialog from "../BaseDialog";
import FeedbackDialog from "../FeedbackDialog";
import { IDialogProps } from "../IDialogProps";
import { Option } from "./Option";
import { PublicRoomResultDetails } from "./PublicRoomResultDetails";
import { RoomResultDetails } from "./RoomResultDetails";
import { TooltipOption } from "./TooltipOption";
import LabelledCheckbox from "../../elements/LabelledCheckbox";
import { useFeatureEnabled } from "../../../../hooks/useSettings";

const MAX_RECENT_SEARCHES = 10;
const SECTION_LIMIT = 50; // only show 50 results per section for performance reasons
const AVATAR_SIZE = 24;

interface IProps extends IDialogProps {
    initialText?: string;
    initialFilter?: Filter;
}

function refIsForRecentlyViewed(ref: RefObject<HTMLElement>): boolean {
    return ref.current?.id?.startsWith("mx_SpotlightDialog_button_recentlyViewed_") === true;
}

function getRoomTypes(showRooms: boolean, showSpaces: boolean): Set<RoomType | null> | null {
    const roomTypes = new Set<RoomType | null>();

    // This is what servers not implementing MSC3827 are expecting
    if (showRooms && !showSpaces) return null;

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
        case Filter.People: return _t("People");
        case Filter.PublicRooms: return _t("Public rooms");
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
    query: [
        publicRoom.room_id.toLowerCase(),
        publicRoom.canonical_alias?.toLowerCase(),
        publicRoom.name?.toLowerCase(),
        sanitizeHtml(publicRoom.topic?.toLowerCase() ?? "", { allowedTags: [] }),
        ...(publicRoom.aliases?.map(it => it.toLowerCase()) || []),
    ].filter(Boolean),
});

const toRoomResult = (room: Room): IRoomResult => {
    const otherUserId = DMRoomMap.shared().getUserIdForRoomId(room.roomId);
    if (otherUserId) {
        return {
            room,
            section: Section.People,
            filter: [Filter.People],
            query: [
                otherUserId.toLowerCase(),
                room.getMember(otherUserId)?.name.toLowerCase(),
            ].filter(Boolean),
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
    query: [
        member.userId.toLowerCase(),
        member.name.toLowerCase(),
    ].filter(Boolean),
});

const recentAlgorithm = new RecentAlgorithm();

export const useWebSearchMetrics = (numResults: number, queryLength: number, viaSpotlight: boolean): void => {
    useEffect(() => {
        if (!queryLength) return;

        // send metrics after a 1s debounce
        const timeoutId = setTimeout(() => {
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

const findVisibleRooms = (cli: MatrixClient) => {
    return cli.getVisibleRooms().filter(room => {
        // TODO we may want to put invites in their own list
        return room.getMyMembership() === "join" || room.getMyMembership() == "invite";
    });
};

const findVisibleRoomMembers = (cli: MatrixClient, filterDMs = true) => {
    return Object.values(
        findVisibleRooms(cli)
            .filter(room => !filterDMs || !DMRoomMap.shared().getUserIdForRoomId(room.roomId))
            .reduce((members, room) => {
                for (const member of room.getJoinedMembers()) {
                    members[member.userId] = member;
                }
                return members;
            }, {} as Record<string, RoomMember>),
    ).filter(it => it.userId !== cli.getUserId());
};

interface IDirectoryOpts {
    limit: number;
    query: string;
}

const SpotlightDialog: React.FC<IProps> = ({ initialText = "", initialFilter = null, onFinished }) => {
    const inputRef = useRef<HTMLInputElement>();
    const scrollContainerRef = useRef<HTMLDivElement>();
    const cli = MatrixClientPeg.get();
    const rovingContext = useContext(RovingTabIndexContext);
    const [query, _setQuery] = useState(initialText);
    const [recentSearches, clearRecentSearches] = useRecentSearches();
    const [filter, setFilterInternal] = useState<Filter | null>(initialFilter);
    const setFilter = useCallback(
        (filter: Filter | null) => {
            setFilterInternal(filter);
            inputRef.current?.focus();
            scrollContainerRef.current?.scrollTo?.({ top: 0 });
        },
        [],
    );
    const memberComparator = useMemo(() => {
        const activityScores = buildActivityScores(cli);
        const memberScores = buildMemberScores(cli);
        return compareMembers(activityScores, memberScores);
    }, [cli]);

    const ownInviteLink = makeUserPermalink(cli.getUserId());
    const [inviteLinkCopied, setInviteLinkCopied] = useState<boolean>(false);
    const trimmedQuery = useMemo(() => query.trim(), [query]);

    const exploringPublicSpacesEnabled = useFeatureEnabled("feature_exploring_public_spaces");

    const { loading: publicRoomsLoading, publicRooms, protocols, config, setConfig, search: searchPublicRooms } =
        usePublicRoomDirectory();
    const [showRooms, setShowRooms] = useState(true);
    const [showSpaces, setShowSpaces] = useState(false);
    const { loading: peopleLoading, users, search: searchPeople } = useUserDirectory();
    const { loading: profileLoading, profile, search: searchProfileInfo } = useProfileInfo();
    const searchParams: [IDirectoryOpts] = useMemo(() => ([{
        query: trimmedQuery,
        roomTypes: getRoomTypes(showRooms, showSpaces),
        limit: SECTION_LIMIT,
    }]), [trimmedQuery, showRooms, showSpaces]);
    useDebouncedCallback(
        filter === Filter.PublicRooms,
        searchPublicRooms,
        searchParams,
    );
    useDebouncedCallback(
        filter === Filter.People,
        searchPeople,
        searchParams,
    );
    useDebouncedCallback(
        filter === Filter.People,
        searchProfileInfo,
        searchParams,
    );
    const possibleResults = useMemo<Result[]>(
        () => {
            const roomMembers = findVisibleRoomMembers(cli);
            const roomMemberIds = new Set(roomMembers.map(item => item.userId));
            return [
                ...SpaceStore.instance.enabledMetaSpaces.map(spaceKey => ({
                    section: Section.Spaces,
                    filter: [],
                    avatar: <div className={classNames(
                        "mx_SpotlightDialog_metaspaceResult",
                        `mx_SpotlightDialog_metaspaceResult_${spaceKey}`,
                    )} />,
                    name: getMetaSpaceName(spaceKey, SpaceStore.instance.allRoomsInHome),
                    onClick() {
                        SpaceStore.instance.setActiveSpace(spaceKey);
                    },
                })),
                ...findVisibleRooms(cli).map(toRoomResult),
                ...roomMembers.map(toMemberResult),
                ...users.filter(item => !roomMemberIds.has(item.userId)).map(toMemberResult),
                ...(profile ? [new DirectoryMember(profile)] : []).map(toMemberResult),
                ...publicRooms.map(toPublicRoomResult),
            ].filter(result => filter === null || result.filter.includes(filter));
        },
        [cli, users, profile, publicRooms, filter],
    );

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

            possibleResults.forEach(entry => {
                if (isRoomResult(entry)) {
                    if (!entry.room.normalizedName.includes(normalizedQuery) &&
                        !entry.room.getCanonicalAlias()?.toLowerCase().includes(lcQuery) &&
                        !entry.query?.some(q => q.includes(lcQuery))
                    ) return; // bail, does not match query
                } else if (isMemberResult(entry)) {
                    if (!entry.query?.some(q => q.includes(lcQuery))) return; // bail, does not match query
                } else if (isPublicRoomResult(entry)) {
                    if (!entry.query?.some(q => q.includes(lcQuery))) return; // bail, does not match query
                } else {
                    if (!entry.name.toLowerCase().includes(lcQuery) &&
                        !entry.query?.some(q => q.includes(lcQuery))
                    ) return; // bail, does not match query
                }

                results[entry.section].push(entry);
            });
        } else if (filter === Filter.PublicRooms) {
            // return all results for public rooms if no query is given
            possibleResults.forEach(entry => {
                if (isPublicRoomResult(entry)) {
                    results[entry.section].push(entry);
                }
            });
        } else if (filter === Filter.People) {
            // return all results for people if no query is given
            possibleResults.forEach(entry => {
                if (isMemberResult(entry)) {
                    results[entry.section].push(entry);
                }
            });
        }

        // Sort results by most recent activity

        const myUserId = cli.getUserId();
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
            });
        }

        return results;
    }, [trimmedQuery, filter, cli, possibleResults, memberComparator]);

    const numResults = sum(Object.values(results).map(it => it.length));
    useWebSearchMetrics(numResults, query.length, true);

    const activeSpace = SpaceStore.instance.activeSpaceRoom;
    const [spaceResults, spaceResultsLoading] = useSpaceResults(activeSpace, query);

    const setQuery = (e: ChangeEvent<HTMLInputElement>): void => {
        const newQuery = e.currentTarget.value;
        _setQuery(newQuery);
    };
    useEffect(() => {
        setImmediate(() => {
            let ref: Ref;
            if (rovingContext.state.refs) {
                ref = rovingContext.state.refs[0];
            }
            rovingContext.dispatch({
                type: Type.SetFocus,
                payload: { ref },
            });
            ref?.current?.scrollIntoView?.({
                block: "nearest",
            });
        });
        // we intentionally ignore changes to the rovingContext for the purpose of this hook
        // we only want to reset the focus whenever the results or filters change
        // eslint-disable-next-line
    }, [results, filter]);

    const viewRoom = (roomId: string, persist = false, viaKeyboard = false) => {
        if (persist) {
            const recents = new Set(SettingsStore.getValue("SpotlightSearch.recentSearches", null).reverse());
            // remove & add the room to put it at the end
            recents.delete(roomId);
            recents.add(roomId);

            SettingsStore.setValue(
                "SpotlightSearch.recentSearches",
                null,
                SettingLevel.ACCOUNT,
                Array.from(recents).reverse().slice(0, MAX_RECENT_SEARCHES),
            );
        }

        defaultDispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: roomId,
            metricsTrigger: "WebUnifiedSearch",
            metricsViaKeyboard: viaKeyboard,
        });
        onFinished();
    };

    let otherSearchesSection: JSX.Element;
    if (trimmedQuery || filter !== Filter.PublicRooms) {
        otherSearchesSection = (
            <div className="mx_SpotlightDialog_section mx_SpotlightDialog_otherSearches" role="group">
                <h4>
                    { trimmedQuery
                        ? _t('Use "%(query)s" to search', { query })
                        : _t("Search for") }
                </h4>
                <div>
                    { (filter !== Filter.PublicRooms) && (
                        <Option
                            id="mx_SpotlightDialog_button_explorePublicRooms"
                            className="mx_SpotlightDialog_explorePublicRooms"
                            onClick={() => setFilter(Filter.PublicRooms)}
                        >
                            { filterToLabel(Filter.PublicRooms) }
                        </Option>
                    ) }
                    { (filter !== Filter.People) && (
                        <Option
                            id="mx_SpotlightDialog_button_startChat"
                            className="mx_SpotlightDialog_startChat"
                            onClick={() => setFilter(Filter.People)}
                        >
                            { filterToLabel(Filter.People) }
                        </Option>
                    ) }
                </div>
            </div>
        );
    }

    let content: JSX.Element;
    if (trimmedQuery || filter !== null) {
        const resultMapper = (result: Result): JSX.Element => {
            if (isRoomResult(result)) {
                return (
                    <Option
                        id={`mx_SpotlightDialog_button_result_${result.room.roomId}`}
                        key={`${Section[result.section]}-${result.room.roomId}`}
                        onClick={(ev) => {
                            viewRoom(result.room.roomId, true, ev?.type !== "click");
                        }}
                    >
                        <DecoratedRoomAvatar room={result.room} avatarSize={AVATAR_SIZE} tooltipProps={{ tabIndex: -1 }} />
                        { result.room.name }
                        <NotificationBadge notification={RoomNotificationStateStore.instance.getRoomState(result.room)} />
                        <RoomResultDetails room={result.room} />
                    </Option>
                );
            }
            if (isMemberResult(result)) {
                return (
                    <Option
                        id={`mx_SpotlightDialog_button_result_${result.member.userId}`}
                        key={`${Section[result.section]}-${result.member.userId}`}
                        onClick={() => {
                            startDm(cli, [result.member]);
                        }}
                    >
                        <SearchResultAvatar user={result.member} size={AVATAR_SIZE} />
                        { result.member instanceof RoomMember ? result.member.rawDisplayName : result.member.name }
                        <div className="mx_SpotlightDialog_result_details">
                            { result.member.userId }
                        </div>
                    </Option>
                );
            }
            if (isPublicRoomResult(result)) {
                const clientRoom = cli.getRoom(result.publicRoom.room_id);
                const listener = (ev) => {
                    viewRoom(result.publicRoom.room_id, true, ev.type !== "click");
                };
                return (
                    <Option
                        id={`mx_SpotlightDialog_button_result_${result.publicRoom.room_id}`}
                        className="mx_SpotlightDialog_result_multiline"
                        key={`${Section[result.section]}-${result.publicRoom.room_id}`}
                        onClick={listener}
                        endAdornment={
                            <AccessibleButton
                                kind={clientRoom ? "primary" : "primary_outline"}
                                onClick={listener}
                                tabIndex={-1}
                            >
                                { _t(clientRoom ? "View" : "Join") }
                            </AccessibleButton>}
                    >
                        <BaseAvatar
                            className="mx_SearchResultAvatar"
                            url={result?.publicRoom?.avatar_url
                                ? mediaFromMxc(result?.publicRoom?.avatar_url).getSquareThumbnailHttp(AVATAR_SIZE)
                                : null}
                            name={result.publicRoom.name}
                            idName={result.publicRoom.room_id}
                            width={AVATAR_SIZE}
                            height={AVATAR_SIZE}
                        />
                        <PublicRoomResultDetails room={result.publicRoom} />
                    </Option>
                );
            }

            // IResult case
            return (
                <Option
                    id={`mx_SpotlightDialog_button_result_${result.name}`}
                    key={`${Section[result.section]}-${result.name}`}
                    onClick={result.onClick}
                >
                    { result.avatar }
                    { result.name }
                    { result.description }
                </Option>
            );
        };

        let peopleSection: JSX.Element;
        if (results[Section.People].length) {
            peopleSection = (
                <div className="mx_SpotlightDialog_section mx_SpotlightDialog_results" role="group">
                    <h4>{ _t("Recent Conversations") }</h4>
                    <div>
                        { results[Section.People].slice(0, SECTION_LIMIT).map(resultMapper) }
                    </div>
                </div>
            );
        }

        let suggestionsSection: JSX.Element;
        if (results[Section.Suggestions].length && filter === Filter.People) {
            suggestionsSection = (
                <div className="mx_SpotlightDialog_section mx_SpotlightDialog_results" role="group">
                    <h4>{ _t("Suggestions") }</h4>
                    <div>
                        { results[Section.Suggestions].slice(0, SECTION_LIMIT).map(resultMapper) }
                    </div>
                </div>
            );
        }

        let roomsSection: JSX.Element;
        if (results[Section.Rooms].length) {
            roomsSection = (
                <div className="mx_SpotlightDialog_section mx_SpotlightDialog_results" role="group">
                    <h4>{ _t("Rooms") }</h4>
                    <div>
                        { results[Section.Rooms].slice(0, SECTION_LIMIT).map(resultMapper) }
                    </div>
                </div>
            );
        }

        let spacesSection: JSX.Element;
        if (results[Section.Spaces].length) {
            spacesSection = (
                <div className="mx_SpotlightDialog_section mx_SpotlightDialog_results" role="group">
                    <h4>{ _t("Spaces you're in") }</h4>
                    <div>
                        { results[Section.Spaces].slice(0, SECTION_LIMIT).map(resultMapper) }
                    </div>
                </div>
            );
        }

        let publicRoomsSection: JSX.Element;
        if (filter === Filter.PublicRooms) {
            publicRoomsSection = (
                <div className="mx_SpotlightDialog_section mx_SpotlightDialog_results" role="group">
                    <div className="mx_SpotlightDialog_sectionHeader">
                        <h4>{ _t("Suggestions") }</h4>
                        <div className="mx_SpotlightDialog_options">
                            { exploringPublicSpacesEnabled && <>
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
                            </> }
                            <NetworkDropdown
                                protocols={protocols}
                                config={config ?? null}
                                setConfig={setConfig}
                            />
                        </div>
                    </div>
                    <div> { (showRooms || showSpaces)
                        ? results[Section.PublicRooms].slice(0, SECTION_LIMIT).map(resultMapper)
                        : <div className="mx_SpotlightDialog_otherSearches_messageSearchText">
                            { _t("You cannot search for rooms that are neither a room nor a space") }
                        </div>
                    } </div>
                </div>
            );
        }

        let spaceRoomsSection: JSX.Element;
        if (spaceResults.length && activeSpace && filter === null) {
            spaceRoomsSection = (
                <div className="mx_SpotlightDialog_section mx_SpotlightDialog_results" role="group">
                    <h4>{ _t("Other rooms in %(spaceName)s", { spaceName: activeSpace.name }) }</h4>
                    <div>
                        { spaceResults.slice(0, SECTION_LIMIT).map((room: IHierarchyRoom): JSX.Element => (
                            <Option
                                id={`mx_SpotlightDialog_button_result_${room.room_id}`}
                                key={room.room_id}
                                onClick={(ev) => {
                                    viewRoom(room.room_id, true, ev?.type !== "click");
                                }}
                            >
                                <BaseAvatar
                                    name={room.name}
                                    idName={room.room_id}
                                    url={room.avatar_url
                                        ? mediaFromMxc(room.avatar_url).getSquareThumbnailHttp(AVATAR_SIZE)
                                        : null
                                    }
                                    width={AVATAR_SIZE}
                                    height={AVATAR_SIZE}
                                />
                                { room.name || room.canonical_alias }
                                { room.name && room.canonical_alias && (
                                    <div className="mx_SpotlightDialog_result_details">
                                        { room.canonical_alias }
                                    </div>
                                ) }
                            </Option>
                        )) }
                        { spaceResultsLoading && <Spinner /> }
                    </div>
                </div>
            );
        }

        let joinRoomSection: JSX.Element;
        if (trimmedQuery.startsWith("#") &&
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
                            { _t("Join %(roomAddress)s", {
                                roomAddress: trimmedQuery,
                            }) }
                        </Option>
                    </div>
                </div>
            );
        }

        let hiddenResultsSection: JSX.Element;
        if (filter === Filter.People) {
            hiddenResultsSection = (
                <div className="mx_SpotlightDialog_section mx_SpotlightDialog_hiddenResults" role="group">
                    <h4>{ _t('Some results may be hidden for privacy') }</h4>
                    <div className="mx_SpotlightDialog_otherSearches_messageSearchText">
                        { _t("If you can't see who you're looking for, send them your invite link.") }
                    </div>
                    <TooltipOption
                        id="mx_SpotlightDialog_button_inviteLink"
                        className="mx_SpotlightDialog_inviteLink"
                        onClick={() => { setInviteLinkCopied(true); copyPlaintext(ownInviteLink); }}
                        onHideTooltip={() => setInviteLinkCopied(false)}
                        title={inviteLinkCopied ? _t("Copied!") : _t("Copy")}
                    >
                        <span className="mx_AccessibleButton mx_AccessibleButton_hasKind mx_AccessibleButton_kind_primary_outline">
                            { _t("Copy invite link") }
                        </span>
                    </TooltipOption>
                </div>
            );
        } else if (trimmedQuery && filter === Filter.PublicRooms) {
            hiddenResultsSection = (
                <div className="mx_SpotlightDialog_section mx_SpotlightDialog_hiddenResults" role="group">
                    <h4>{ _t('Some results may be hidden') }</h4>
                    <div className="mx_SpotlightDialog_otherSearches_messageSearchText">
                        { _t("If you can't find the room you're looking for, " +
                                    "ask for an invite or create a new room.") }
                    </div>
                    <Option
                        id="mx_SpotlightDialog_button_createNewRoom"
                        className="mx_SpotlightDialog_createRoom"
                        onClick={() => defaultDispatcher.dispatch({
                            action: 'view_create_room',
                            public: true,
                            defaultName: capitalize(trimmedQuery),
                        })}
                    >
                        <span className="mx_AccessibleButton mx_AccessibleButton_hasKind mx_AccessibleButton_kind_primary_outline">
                            { _t("Create new room") }
                        </span>
                    </Option>
                </div>
            );
        }

        let groupChatSection: JSX.Element;
        if (filter === Filter.People) {
            groupChatSection = (
                <div className="mx_SpotlightDialog_section mx_SpotlightDialog_otherSearches" role="group">
                    <h4>{ _t('Other options') }</h4>
                    <Option
                        id="mx_SpotlightDialog_button_startGroupChat"
                        className="mx_SpotlightDialog_startGroupChat"
                        onClick={() => showStartChatInviteDialog(trimmedQuery)}
                    >
                        { _t("Start a group chat") }
                    </Option>
                </div>
            );
        }

        let messageSearchSection: JSX.Element;
        if (filter === null) {
            messageSearchSection = (
                <div className="mx_SpotlightDialog_section mx_SpotlightDialog_otherSearches" role="group">
                    <h4>{ _t("Other searches") }</h4>
                    <div className="mx_SpotlightDialog_otherSearches_messageSearchText">
                        { _t(
                            "To search messages, look for this icon at the top of a room <icon/>",
                            {},
                            { icon: () => <div className="mx_SpotlightDialog_otherSearches_messageSearchIcon" /> },
                        ) }
                    </div>
                </div>
            );
        }

        content = <>
            { peopleSection }
            { suggestionsSection }
            { roomsSection }
            { spacesSection }
            { spaceRoomsSection }
            { publicRoomsSection }
            { joinRoomSection }
            { hiddenResultsSection }
            { otherSearchesSection }
            { groupChatSection }
            { messageSearchSection }
        </>;
    } else {
        let recentSearchesSection: JSX.Element;
        if (recentSearches.length) {
            recentSearchesSection = (
                <div
                    className="mx_SpotlightDialog_section mx_SpotlightDialog_recentSearches"
                    role="group"
                    // Firefox sometimes makes this element focusable due to overflow,
                    // so force it out of tab order by default.
                    tabIndex={-1}
                >
                    <h4>
                        { _t("Recent searches") }
                        <AccessibleButton kind="link" onClick={clearRecentSearches}>
                            { _t("Clear") }
                        </AccessibleButton>
                    </h4>
                    <div>
                        { recentSearches.map(room => (
                            <Option
                                id={`mx_SpotlightDialog_button_recentSearch_${room.roomId}`}
                                key={room.roomId}
                                onClick={(ev) => {
                                    viewRoom(room.roomId, true, ev?.type !== "click");
                                }}
                            >
                                <DecoratedRoomAvatar room={room} avatarSize={AVATAR_SIZE} tooltipProps={{ tabIndex: -1 }} />
                                { room.name }
                                <NotificationBadge notification={RoomNotificationStateStore.instance.getRoomState(room)} />
                                <RoomResultDetails room={room} />
                            </Option>
                        )) }
                    </div>
                </div>
            );
        }

        content = <>
            <div className="mx_SpotlightDialog_section mx_SpotlightDialog_recentlyViewed" role="group">
                <h4>{ _t("Recently viewed") }</h4>
                <div>
                    { BreadcrumbsStore.instance.rooms
                        .filter(r => r.roomId !== RoomViewStore.instance.getRoomId())
                        .map(room => (
                            <TooltipOption
                                id={`mx_SpotlightDialog_button_recentlyViewed_${room.roomId}`}
                                title={room.name}
                                key={room.roomId}
                                onClick={(ev) => {
                                    viewRoom(room.roomId, false, ev.type !== "click");
                                }}
                            >
                                <DecoratedRoomAvatar room={room} avatarSize={32} tooltipProps={{ tabIndex: -1 }} />
                                { room.name }
                            </TooltipOption>
                        ))
                    }
                </div>
            </div>

            { recentSearchesSection }
            { otherSearchesSection }
        </>;
    }

    const onDialogKeyDown = (ev: KeyboardEvent) => {
        const navigationAction = getKeyBindingsManager().getNavigationAction(ev);
        switch (navigationAction) {
            case KeyBindingAction.FilterRooms:
                ev.stopPropagation();
                ev.preventDefault();
                onFinished();
                break;
        }

        const accessibilityAction = getKeyBindingsManager().getAccessibilityAction(ev);
        switch (accessibilityAction) {
            case KeyBindingAction.Escape:
                ev.stopPropagation();
                ev.preventDefault();
                onFinished();
                break;
        }
    };

    const onKeyDown = (ev: KeyboardEvent) => {
        let ref: RefObject<HTMLElement>;

        const action = getKeyBindingsManager().getAccessibilityAction(ev);

        switch (action) {
            case KeyBindingAction.Backspace:
                if (!query && filter !== null) {
                    ev.stopPropagation();
                    ev.preventDefault();
                    setFilter(null);
                }
                break;
            case KeyBindingAction.ArrowUp:
            case KeyBindingAction.ArrowDown:
                ev.stopPropagation();
                ev.preventDefault();

                if (rovingContext.state.refs.length > 0) {
                    let refs = rovingContext.state.refs;
                    if (!query && !filter !== null) {
                        // If the current selection is not in the recently viewed row then only include the
                        // first recently viewed so that is the target when the user is switching into recently viewed.
                        const keptRecentlyViewedRef = refIsForRecentlyViewed(rovingContext.state.activeRef)
                            ? rovingContext.state.activeRef
                            : refs.find(refIsForRecentlyViewed);
                        // exclude all other recently viewed items from the list so up/down arrows skip them
                        refs = refs.filter(ref => ref === keptRecentlyViewedRef || !refIsForRecentlyViewed(ref));
                    }

                    const idx = refs.indexOf(rovingContext.state.activeRef);
                    ref = findSiblingElement(refs, idx + (action === KeyBindingAction.ArrowUp ? -1 : 1));
                }
                break;

            case KeyBindingAction.ArrowLeft:
            case KeyBindingAction.ArrowRight:
                // only handle these keys when we are in the recently viewed row of options
                if (!query && !filter !== null &&
                    rovingContext.state.refs.length > 0 &&
                    refIsForRecentlyViewed(rovingContext.state.activeRef)
                ) {
                    // we only intercept left/right arrows when the field is empty, and they'd do nothing anyway
                    ev.stopPropagation();
                    ev.preventDefault();

                    const refs = rovingContext.state.refs.filter(refIsForRecentlyViewed);
                    const idx = refs.indexOf(rovingContext.state.activeRef);
                    ref = findSiblingElement(refs, idx + (action === KeyBindingAction.ArrowLeft ? -1 : 1));
                }
                break;
            case KeyBindingAction.Enter:
                ev.stopPropagation();
                ev.preventDefault();
                rovingContext.state.activeRef?.current?.click();
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

    const openFeedback = SdkConfig.get().bug_report_endpoint_url ? () => {
        Modal.createDialog(FeedbackDialog);
    } : null;

    const activeDescendant = rovingContext.state.activeRef?.current?.id;

    return <>
        <div id="mx_SpotlightDialog_keyboardPrompt">
            { _t("Use <arrows/> to scroll", {}, {
                arrows: () => <>
                    <div>↓</div>
                    <div>↑</div>
                    { !filter !== null && !query && <div>←</div> }
                    { !filter !== null && !query && <div>→</div> }
                </>,
            }) }
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
                { filter !== null && (
                    <div className={classNames("mx_SpotlightDialog_filter", {
                        "mx_SpotlightDialog_filterPeople": filter === Filter.People,
                        "mx_SpotlightDialog_filterPublicRooms": filter === Filter.PublicRooms,
                    })}>
                        <span>{ filterToLabel(filter) }</span>
                        <AccessibleButton
                            tabIndex={-1}
                            alt={_t("Remove search filter for %(filter)s", {
                                filter: filterToLabel(filter),
                            })}
                            className="mx_SpotlightDialog_filter--close"
                            onClick={() => setFilter(null)}
                        />
                    </div>
                ) }
                <input
                    ref={inputRef}
                    autoFocus
                    type="text"
                    autoComplete="off"
                    placeholder={_t("Search")}
                    value={query}
                    onChange={setQuery}
                    onKeyDown={onKeyDown}
                    aria-owns="mx_SpotlightDialog_content"
                    aria-activedescendant={activeDescendant}
                    aria-label={_t("Search")}
                    aria-describedby="mx_SpotlightDialog_keyboardPrompt"
                />
                { (publicRoomsLoading || peopleLoading || profileLoading) && (
                    <Spinner w={24} h={24} />
                ) }
            </div>

            <div
                ref={scrollContainerRef}
                id="mx_SpotlightDialog_content"
                role="listbox"
                aria-activedescendant={activeDescendant}
                aria-describedby="mx_SpotlightDialog_keyboardPrompt"
            >
                { content }
            </div>

            <div className="mx_SpotlightDialog_footer">
                { openFeedback && _t("Results not as expected? Please <a>give feedback</a>.", {}, {
                    a: sub => <AccessibleButton kind="link_inline" onClick={openFeedback}>
                        { sub }
                    </AccessibleButton>,
                }) }
                { openFeedback && <AccessibleButton
                    kind="primary_outline"
                    onClick={openFeedback}
                >
                    { _t("Feedback") }
                </AccessibleButton> }
            </div>
        </BaseDialog>
    </>;
};

const RovingSpotlightDialog: React.FC<IProps> = (props) => {
    return <RovingTabIndexProvider>
        { () => <SpotlightDialog {...props} /> }
    </RovingTabIndexProvider>;
};

export default RovingSpotlightDialog;
