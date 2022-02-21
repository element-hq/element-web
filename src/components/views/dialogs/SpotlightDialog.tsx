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

import React, {
    ChangeEvent,
    ComponentProps,
    KeyboardEvent,
    RefObject,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import { normalize } from "matrix-js-sdk/src/utils";
import { IHierarchyRoom } from "matrix-js-sdk/src/@types/spaces";
import { RoomHierarchy } from "matrix-js-sdk/src/room-hierarchy";
import { RoomType } from "matrix-js-sdk/src/@types/event";
import { WebSearch as WebSearchEvent } from "matrix-analytics-events/types/typescript/WebSearch";

import { IDialogProps } from "./IDialogProps";
import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import { BreadcrumbsStore } from "../../../stores/BreadcrumbsStore";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import {
    findSiblingElement,
    RovingAccessibleButton,
    RovingAccessibleTooltipButton,
    RovingTabIndexContext,
    RovingTabIndexProvider,
    Type,
    useRovingTabIndex,
} from "../../../accessibility/RovingTabIndex";
import { Key } from "../../../Keyboard";
import AccessibleButton from "../elements/AccessibleButton";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import SpaceStore from "../../../stores/spaces/SpaceStore";
import DMRoomMap from "../../../utils/DMRoomMap";
import { mediaFromMxc } from "../../../customisations/Media";
import BaseAvatar from "../avatars/BaseAvatar";
import Spinner from "../elements/Spinner";
import { roomContextDetailsText, spaceContextDetailsText } from "../../../Rooms";
import DecoratedRoomAvatar from "../avatars/DecoratedRoomAvatar";
import { Action } from "../../../dispatcher/actions";
import Modal from "../../../Modal";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import RoomViewStore from "../../../stores/RoomViewStore";
import { showStartChatInviteDialog } from "../../../RoomInvite";
import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";
import NotificationBadge from "../rooms/NotificationBadge";
import { RoomNotificationStateStore } from "../../../stores/notifications/RoomNotificationStateStore";
import { BetaPill } from "../beta/BetaCard";
import { UserTab } from "./UserSettingsDialog";
import BetaFeedbackDialog from "./BetaFeedbackDialog";
import SdkConfig from "../../../SdkConfig";
import { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { getMetaSpaceName } from "../../../stores/spaces";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import { PosthogAnalytics } from "../../../PosthogAnalytics";
import { getCachedRoomIDForAlias } from "../../../RoomAliasCache";

const MAX_RECENT_SEARCHES = 10;
const SECTION_LIMIT = 50; // only show 50 results per section for performance reasons

const Option: React.FC<ComponentProps<typeof RovingAccessibleButton>> = ({ inputRef, children, ...props }) => {
    const [onFocus, isActive, ref] = useRovingTabIndex(inputRef);
    return <AccessibleButton
        {...props}
        onFocus={onFocus}
        inputRef={ref}
        tabIndex={-1}
        aria-selected={isActive}
        role="option"
    >
        { children }
        <div className="mx_SpotlightDialog_enterPrompt" aria-hidden>↵</div>
    </AccessibleButton>;
};

const TooltipOption: React.FC<ComponentProps<typeof RovingAccessibleTooltipButton>> = ({ inputRef, ...props }) => {
    const [onFocus, isActive, ref] = useRovingTabIndex(inputRef);
    return <AccessibleTooltipButton
        {...props}
        onFocus={onFocus}
        inputRef={ref}
        tabIndex={-1}
        aria-selected={isActive}
        role="option"
    />;
};

const useRecentSearches = (): [Room[], () => void] => {
    const [rooms, setRooms] = useState(() => {
        const cli = MatrixClientPeg.get();
        const recents = SettingsStore.getValue("SpotlightSearch.recentSearches", null);
        return recents.map(r => cli.getRoom(r)).filter(Boolean);
    });

    return [rooms, () => {
        SettingsStore.setValue("SpotlightSearch.recentSearches", null, SettingLevel.ACCOUNT, []);
        setRooms([]);
    }];
};

const ResultDetails = ({ room }: { room: Room }) => {
    const contextDetails = room.isSpaceRoom() ? spaceContextDetailsText(room) : roomContextDetailsText(room);
    if (contextDetails) {
        return <div className="mx_SpotlightDialog_result_details">
            { contextDetails }
        </div>;
    }

    return null;
};

interface IProps extends IDialogProps {
    initialText?: string;
}

const useSpaceResults = (space?: Room, query?: string): [IHierarchyRoom[], boolean] => {
    const [rooms, setRooms] = useState<IHierarchyRoom[]>([]);
    const [hierarchy, setHierarchy] = useState<RoomHierarchy>();

    const resetHierarchy = useCallback(() => {
        setHierarchy(space ? new RoomHierarchy(space, 50) : null);
    }, [space]);
    useEffect(resetHierarchy, [resetHierarchy]);

    useEffect(() => {
        if (!space || !hierarchy) return; // nothing to load

        let unmounted = false;

        (async () => {
            while (hierarchy?.canLoadMore && !unmounted && space === hierarchy.root) {
                await hierarchy.load();
                if (hierarchy.canLoadMore) hierarchy.load(); // start next load so that the loading attribute is right
                setRooms(hierarchy.rooms);
            }
        })();

        return () => {
            unmounted = true;
        };
    }, [space, hierarchy]);

    const results = useMemo(() => {
        const trimmedQuery = query.trim();
        const lcQuery = trimmedQuery.toLowerCase();
        const normalizedQuery = normalize(trimmedQuery);

        const cli = MatrixClientPeg.get();
        return rooms?.filter(r => {
            return r.room_type !== RoomType.Space &&
                cli.getRoom(r.room_id)?.getMyMembership() !== "join" &&
                (
                    normalize(r.name || "").includes(normalizedQuery) ||
                    (r.canonical_alias || "").includes(lcQuery)
                );
        });
    }, [rooms, query]);

    return [results, hierarchy?.loading ?? false];
};

function refIsForRecentlyViewed(ref: RefObject<HTMLElement>): boolean {
    return ref.current?.id.startsWith("mx_SpotlightDialog_button_recentlyViewed_");
}

enum Section {
    People,
    Rooms,
    Spaces,
}

interface IBaseResult {
    section: Section;
    query?: string[]; // extra fields to query match, stored as lowercase
}

interface IRoomResult extends IBaseResult {
    room: Room;
}

interface IResult extends IBaseResult {
    avatar: JSX.Element;
    name: string;
    description?: string;
    onClick?(): void;
}

type Result = IRoomResult | IResult;

const isRoomResult = (result: any): result is IRoomResult => !!result?.room;

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

const SpotlightDialog: React.FC<IProps> = ({ initialText = "", onFinished }) => {
    const cli = MatrixClientPeg.get();
    const rovingContext = useContext(RovingTabIndexContext);
    const [query, _setQuery] = useState(initialText);
    const [recentSearches, clearRecentSearches] = useRecentSearches();

    const possibleResults = useMemo<Result[]>(() => [
        ...SpaceStore.instance.enabledMetaSpaces.map(spaceKey => ({
            section: Section.Spaces,
            avatar: (
                <div className={`mx_SpotlightDialog_metaspaceResult mx_SpotlightDialog_metaspaceResult_${spaceKey}`} />
            ),
            name: getMetaSpaceName(spaceKey, SpaceStore.instance.allRoomsInHome),
            onClick() {
                SpaceStore.instance.setActiveSpace(spaceKey);
            },
        })),
        ...cli.getVisibleRooms().map(room => {
            let section: Section;
            let query: string[];

            const otherUserId = DMRoomMap.shared().getUserIdForRoomId(room.roomId);
            if (otherUserId) {
                section = Section.People;
                query = [
                    otherUserId.toLowerCase(),
                    room.getMember(otherUserId)?.name.toLowerCase(),
                ].filter(Boolean);
            } else if (room.isSpaceRoom()) {
                section = Section.Spaces;
            } else {
                section = Section.Rooms;
            }

            return { room, section, query };
        }),
    ], [cli]);

    const trimmedQuery = query.trim();
    const [people, rooms, spaces] = useMemo<[Result[], Result[], Result[]] | []>(() => {
        if (!trimmedQuery) return [];

        const lcQuery = trimmedQuery.toLowerCase();
        const normalizedQuery = normalize(trimmedQuery);

        const results: [Result[], Result[], Result[]] = [[], [], []];

        possibleResults.forEach(entry => {
            if (isRoomResult(entry)) {
                if (!entry.room.normalizedName.includes(normalizedQuery) &&
                    !entry.room.getCanonicalAlias()?.toLowerCase().includes(lcQuery) &&
                    !entry.query?.some(q => q.includes(lcQuery))
                ) return; // bail, does not match query
            } else {
                if (!entry.name.toLowerCase().includes(lcQuery) &&
                    !entry.query?.some(q => q.includes(lcQuery))
                ) return; // bail, does not match query
            }

            results[entry.section].push(entry);
        });

        return results;
    }, [possibleResults, trimmedQuery]);

    const numResults = trimmedQuery ? people.length + rooms.length + spaces.length : 0;
    useWebSearchMetrics(numResults, query.length, true);

    const activeSpace = SpaceStore.instance.activeSpaceRoom;
    const [spaceResults, spaceResultsLoading] = useSpaceResults(activeSpace, query);

    const setQuery = (e: ChangeEvent<HTMLInputElement>): void => {
        const newQuery = e.currentTarget.value;
        _setQuery(newQuery);

        setImmediate(() => {
            // reset the activeRef when we change query for best usability
            const ref = rovingContext.state.refs[0];
            if (ref) {
                rovingContext.dispatch({
                    type: Type.SetFocus,
                    payload: { ref },
                });
                ref.current?.scrollIntoView({
                    block: "nearest",
                });
            }
        });
    };

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

    let content: JSX.Element;
    if (trimmedQuery) {
        const resultMapper = (result: Result): JSX.Element => {
            if (isRoomResult(result)) {
                return (
                    <Option
                        id={`mx_SpotlightDialog_button_result_${result.room.roomId}`}
                        key={result.room.roomId}
                        onClick={(ev) => {
                            viewRoom(result.room.roomId, true, ev.type !== "click");
                        }}
                    >
                        <DecoratedRoomAvatar room={result.room} avatarSize={20} tooltipProps={{ tabIndex: -1 }} />
                        { result.room.name }
                        <NotificationBadge notification={RoomNotificationStateStore.instance.getRoomState(result.room)} />
                        <ResultDetails room={result.room} />
                    </Option>
                );
            }

            const otherResult = (result as IResult);
            return (
                <Option
                    id={`mx_SpotlightDialog_button_result_${otherResult.name}`}
                    key={otherResult.name}
                    onClick={otherResult.onClick}
                >
                    { otherResult.avatar }
                    { otherResult.name }
                    { otherResult.description }
                </Option>
            );
        };

        let peopleSection: JSX.Element;
        if (people.length) {
            peopleSection = <div className="mx_SpotlightDialog_section mx_SpotlightDialog_results" role="group">
                <h4>{ _t("People") }</h4>
                <div>
                    { people.slice(0, SECTION_LIMIT).map(resultMapper) }
                </div>
            </div>;
        }

        let roomsSection: JSX.Element;
        if (rooms.length) {
            roomsSection = <div className="mx_SpotlightDialog_section mx_SpotlightDialog_results" role="group">
                <h4>{ _t("Rooms") }</h4>
                <div>
                    { rooms.slice(0, SECTION_LIMIT).map(resultMapper) }
                </div>
            </div>;
        }

        let spacesSection: JSX.Element;
        if (spaces.length) {
            spacesSection = <div className="mx_SpotlightDialog_section mx_SpotlightDialog_results" role="group">
                <h4>{ _t("Spaces you're in") }</h4>
                <div>
                    { spaces.slice(0, SECTION_LIMIT).map(resultMapper) }
                </div>
            </div>;
        }

        let spaceRoomsSection: JSX.Element;
        if (spaceResults.length) {
            spaceRoomsSection = <div className="mx_SpotlightDialog_section mx_SpotlightDialog_results" role="group">
                <h4>{ _t("Other rooms in %(spaceName)s", { spaceName: activeSpace.name }) }</h4>
                <div>
                    { spaceResults.slice(0, SECTION_LIMIT).map((room: IHierarchyRoom): JSX.Element => (
                        <Option
                            id={`mx_SpotlightDialog_button_result_${room.room_id}`}
                            key={room.room_id}
                            onClick={(ev) => {
                                viewRoom(room.room_id, true, ev.type !== "click");
                            }}
                        >
                            <BaseAvatar
                                name={room.name}
                                idName={room.room_id}
                                url={room.avatar_url ? mediaFromMxc(room.avatar_url).getSquareThumbnailHttp(20) : null}
                                width={20}
                                height={20}
                            />
                            { room.name || room.canonical_alias }
                            { room.name && room.canonical_alias && <div className="mx_SpotlightDialog_result_details">
                                { room.canonical_alias }
                            </div> }
                        </Option>
                    )) }
                    { spaceResultsLoading && <Spinner /> }
                </div>
            </div>;
        }

        let joinRoomSection: JSX.Element;
        if (trimmedQuery.startsWith("#") &&
            trimmedQuery.includes(":") &&
            (!getCachedRoomIDForAlias(trimmedQuery) || !cli.getRoom(getCachedRoomIDForAlias(trimmedQuery)))
        ) {
            joinRoomSection = <div className="mx_SpotlightDialog_section mx_SpotlightDialog_otherSearches" role="group">
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
                                metricsViaKeyboard: ev.type !== "click",
                            });
                            onFinished();
                        }}
                    >
                        { _t("Join %(roomAddress)s", {
                            roomAddress: trimmedQuery,
                        }) }
                    </Option>
                </div>
            </div>;
        }

        content = <>
            { peopleSection }
            { roomsSection }
            { spacesSection }
            { spaceRoomsSection }
            { joinRoomSection }
            <div className="mx_SpotlightDialog_section mx_SpotlightDialog_otherSearches" role="group">
                <h4>{ _t('Use "%(query)s" to search', { query }) }</h4>
                <div>
                    <Option
                        id="mx_SpotlightDialog_button_explorePublicRooms"
                        className="mx_SpotlightDialog_explorePublicRooms"
                        onClick={() => {
                            defaultDispatcher.dispatch({
                                action: Action.ViewRoomDirectory,
                                initialText: query,
                            });
                            onFinished();
                        }}
                    >
                        { _t("Public rooms") }
                    </Option>
                    <Option
                        id="mx_SpotlightDialog_button_startChat"
                        className="mx_SpotlightDialog_startChat"
                        onClick={() => {
                            showStartChatInviteDialog(query);
                            onFinished();
                        }}
                    >
                        { _t("People") }
                    </Option>
                </div>
            </div>
            <div className="mx_SpotlightDialog_section mx_SpotlightDialog_otherSearches" role="group">
                <h4>{ _t("Other searches") }</h4>
                <div className="mx_SpotlightDialog_otherSearches_messageSearchText">
                    { _t("To search messages, look for this icon at the top of a room <icon/>", {}, {
                        icon: () => <div className="mx_SpotlightDialog_otherSearches_messageSearchIcon" />,
                    }) }
                </div>
            </div>
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
                                    viewRoom(room.roomId, true, ev.type !== "click");
                                }}
                            >
                                <DecoratedRoomAvatar room={room} avatarSize={20} tooltipProps={{ tabIndex: -1 }} />
                                { room.name }
                                <NotificationBadge notification={RoomNotificationStateStore.instance.getRoomState(room)} />
                                <ResultDetails room={room} />
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
                        .filter(r => r.roomId !== RoomViewStore.getRoomId())
                        .slice(0, 10)
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

            <div className="mx_SpotlightDialog_section mx_SpotlightDialog_otherSearches" role="group">
                <h4>{ _t("Other searches") }</h4>
                <div>
                    <Option
                        id="mx_SpotlightDialog_button_explorePublicRooms"
                        className="mx_SpotlightDialog_explorePublicRooms"
                        onClick={() => {
                            defaultDispatcher.fire(Action.ViewRoomDirectory);
                            onFinished();
                        }}
                    >
                        { _t("Explore public rooms") }
                    </Option>
                </div>
            </div>
        </>;
    }

    const onDialogKeyDown = (ev: KeyboardEvent) => {
        const navAction = getKeyBindingsManager().getNavigationAction(ev);
        switch (navAction) {
            case "KeyBinding.closeDialogOrContextMenu" as KeyBindingAction:
            case KeyBindingAction.FilterRooms:
                ev.stopPropagation();
                ev.preventDefault();
                onFinished();
                break;
        }
    };

    const onKeyDown = (ev: KeyboardEvent) => {
        let ref: RefObject<HTMLElement>;

        switch (ev.key) {
            case Key.ARROW_UP:
            case Key.ARROW_DOWN:
                ev.stopPropagation();
                ev.preventDefault();

                if (rovingContext.state.refs.length > 0) {
                    let refs = rovingContext.state.refs;
                    if (!query) {
                        // If the current selection is not in the recently viewed row then only include the
                        // first recently viewed so that is the target when the user is switching into recently viewed.
                        const keptRecentlyViewedRef = refIsForRecentlyViewed(rovingContext.state.activeRef)
                            ? rovingContext.state.activeRef
                            : refs.find(refIsForRecentlyViewed);
                        // exclude all other recently viewed items from the list so up/down arrows skip them
                        refs = refs.filter(ref => ref === keptRecentlyViewedRef || !refIsForRecentlyViewed(ref));
                    }

                    const idx = refs.indexOf(rovingContext.state.activeRef);
                    ref = findSiblingElement(refs, idx + (ev.key === Key.ARROW_UP ? -1 : 1));
                }
                break;

            case Key.ARROW_LEFT:
            case Key.ARROW_RIGHT:
                // only handle these keys when we are in the recently viewed row of options
                if (!query &&
                    rovingContext.state.refs.length > 0 &&
                    refIsForRecentlyViewed(rovingContext.state.activeRef)
                ) {
                    // we only intercept left/right arrows when the field is empty, and they'd do nothing anyway
                    ev.stopPropagation();
                    ev.preventDefault();

                    const refs = rovingContext.state.refs.filter(refIsForRecentlyViewed);
                    const idx = refs.indexOf(rovingContext.state.activeRef);
                    ref = findSiblingElement(refs, idx + (ev.key === Key.ARROW_LEFT ? -1 : 1));
                }
                break;

            case Key.ENTER:
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
        Modal.createTrackedDialog("Spotlight Feedback", "feature_spotlight", BetaFeedbackDialog, {
            featureId: "feature_spotlight",
        });
    } : null;

    const activeDescendant = rovingContext.state.activeRef?.current?.id;

    return <>
        <div id="mx_SpotlightDialog_keyboardPrompt">
            { _t("Use <arrows/> to scroll", {}, {
                arrows: () => <>
                    <div>↓</div>
                    <div>↑</div>
                    { !query && <div>←</div> }
                    { !query && <div>→</div> }
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
                <input
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
            </div>

            <div
                id="mx_SpotlightDialog_content"
                role="listbox"
                aria-activedescendant={activeDescendant}
                aria-describedby="mx_SpotlightDialog_keyboardPrompt"
            >
                { content }
            </div>

            <div className="mx_SpotlightDialog_footer">
                <BetaPill onClick={() => {
                    defaultDispatcher.dispatch({
                        action: Action.ViewUserSettings,
                        initialTabId: UserTab.Labs,
                    });
                    onFinished();
                }} />
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
