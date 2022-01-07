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

import { IDialogProps } from "./IDialogProps";
import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import { BreadcrumbsStore } from "../../../stores/BreadcrumbsStore";
import RoomAvatar from "../avatars/RoomAvatar";
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
import { roomContextDetailsText } from "../../../Rooms";
import DecoratedRoomAvatar from "../avatars/DecoratedRoomAvatar";
import { Action } from "../../../dispatcher/actions";
import Modal from "../../../Modal";
import GenericFeatureFeedbackDialog from "./GenericFeatureFeedbackDialog";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import RoomViewStore from "../../../stores/RoomViewStore";
import { showStartChatInviteDialog } from "../../../RoomInvite";
import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";

const MAX_RECENT_SEARCHES = 10;
const SECTION_LIMIT = 50; // only show 50 results per section for performance reasons

const Option: React.FC<ComponentProps<typeof RovingAccessibleButton>> = ({ inputRef, ...props }) => {
    const [onFocus, isActive, ref] = useRovingTabIndex(inputRef);
    return <AccessibleButton
        {...props}
        onFocus={onFocus}
        inputRef={ref}
        tabIndex={-1}
        aria-selected={isActive}
        role="option"
    />;
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
    const roomContextDetails = roomContextDetailsText(room);
    if (roomContextDetails) {
        return <div className="mx_SpotlightDialog_result_details">
            { roomContextDetails }
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
        const hierarchy = new RoomHierarchy(space, 50);
        setHierarchy(hierarchy);
    }, [space]);
    useEffect(resetHierarchy, [resetHierarchy]);

    useEffect(() => {
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

const SpotlightDialog: React.FC<IProps> = ({ initialText = "", onFinished }) => {
    const cli = MatrixClientPeg.get();
    const rovingContext = useContext(RovingTabIndexContext);
    const [query, _setQuery] = useState(initialText);
    const [recentSearches, clearRecentSearches] = useRecentSearches();

    const results = useMemo<Room[] | null>(() => {
        if (!query) return null;

        const trimmedQuery = query.trim();
        const lcQuery = trimmedQuery.toLowerCase();
        const normalizedQuery = normalize(trimmedQuery);

        return cli.getVisibleRooms().filter(r => {
            return r.getCanonicalAlias()?.includes(lcQuery) || r.normalizedName.includes(normalizedQuery);
        });
    }, [cli, query]);

    const activeSpace = SpaceStore.instance.activeSpaceRoom;
    const [spaceResults, spaceResultsLoading] = useSpaceResults(activeSpace, query);

    const setQuery = (e: ChangeEvent<HTMLInputElement>): void => {
        const newQuery = e.currentTarget.value;
        _setQuery(newQuery);
        if (!query !== !newQuery) {
            setImmediate(() => {
                // reset the activeRef when we start/stop querying as the view changes
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
        }
    };

    const viewRoom = (roomId: string, persist = false) => {
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

        defaultDispatcher.dispatch({
            action: 'view_room',
            room_id: roomId,
        });
        onFinished();
    };

    let content: JSX.Element;
    if (results) {
        const [people, rooms, spaces] = results.reduce((result, room: Room) => {
            if (room.isSpaceRoom()) result[2].push(room);
            else if (!DMRoomMap.shared().getUserIdForRoomId(room.roomId)) result[1].push(room);
            else result[0].push(room);
            return result;
        }, [[], [], []] as [Room[], Room[], Room[]]);

        const resultMapper = (room: Room): JSX.Element => (
            <Option
                id={`mx_SpotlightDialog_button_result_${room.roomId}`}
                key={room.roomId}
                onClick={() => {
                    viewRoom(room.roomId, true);
                }}
            >
                <RoomAvatar room={room} width={20} height={20} />
                { room.name }
                <ResultDetails room={room} />
                <div className="mx_SpotlightDialog_enterPrompt">↵</div>
            </Option>
        );

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
                            onClick={() => {
                                viewRoom(room.room_id, true);
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
                            <div className="mx_SpotlightDialog_enterPrompt">↵</div>
                        </Option>
                    )) }
                    { spaceResultsLoading && <Spinner /> }
                </div>
            </div>;
        }

        content = <>
            { peopleSection }
            { roomsSection }
            { spacesSection }
            { spaceRoomsSection }
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
                        <div className="mx_SpotlightDialog_enterPrompt">↵</div>
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
                        <div className="mx_SpotlightDialog_enterPrompt">↵</div>
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
                <div className="mx_SpotlightDialog_section mx_SpotlightDialog_recentSearches" role="group">
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
                                onClick={() => {
                                    viewRoom(room.roomId, true);
                                }}
                            >
                                <RoomAvatar room={room} width={20} height={20} />
                                { room.name }
                                <div className="mx_SpotlightDialog_enterPrompt">↵</div>
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
                                onClick={() => {
                                    viewRoom(room.roomId);
                                }}
                            >
                                <DecoratedRoomAvatar room={room} avatarSize={32} />
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
                        <div className="mx_SpotlightDialog_enterPrompt">↵</div>
                    </Option>
                </div>
            </div>
        </>;
    }

    const onDialogKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === Key.ESCAPE) {
            ev.stopPropagation();
            ev.preventDefault();
            onFinished();
        }
    };

    const onKeyDown = (ev: KeyboardEvent) => {
        switch (ev.key) {
            case Key.ARROW_UP:
            case Key.ARROW_DOWN:
                ev.stopPropagation();
                ev.preventDefault();

                if (rovingContext.state.refs.length > 0) {
                    const idx = rovingContext.state.refs.indexOf(rovingContext.state.activeRef);
                    const ref = findSiblingElement(rovingContext.state.refs, idx + (ev.key === Key.ARROW_UP ? -1 : 1));

                    if (ref) {
                        rovingContext.dispatch({
                            type: Type.SetFocus,
                            payload: { ref },
                        });
                        ref.current?.scrollIntoView({
                            block: "nearest",
                        });
                    }
                }
                break;

            case Key.ENTER:
                ev.stopPropagation();
                ev.preventDefault();
                rovingContext.state.activeRef?.current?.click();
                break;
        }
    };

    const activeDescendant = rovingContext.state.activeRef?.current?.id;

    return <>
        <div className="mx_SpotlightDialog_keyboardPrompt">
            { _t("Use <arrows/> to scroll results", {}, {
                arrows: () => <>
                    <div>↓</div>
                    <div>↑</div>
                </>,
            }) }
        </div>

        <BaseDialog
            className="mx_SpotlightDialog"
            onFinished={onFinished}
            hasCancel={false}
            onKeyDown={onDialogKeyDown}
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
                />
            </div>

            <div id="mx_SpotlightDialog_content" role="listbox" aria-activedescendant={activeDescendant}>
                { content }
            </div>

            <div className="mx_SpotlightDialog_footer">
                <span>
                    { activeSpace
                        ? _t("Searching rooms and chats you're in and %(spaceName)s", { spaceName: activeSpace.name })
                        : _t("Searching rooms and chats you're in") }
                </span>
                <AccessibleButton
                    kind="primary_outline"
                    onClick={() => {
                        Modal.createTrackedDialog("Spotlight Feedback", "", GenericFeatureFeedbackDialog, {
                            title: _t("Spotlight search feedback"),
                            subheading: _t("Thank you for trying Spotlight search. " +
                                "Your feedback will help inform the next versions."),
                            rageshakeLabel: "spotlight-feedback",
                        });
                    }}
                >
                    { _t("Feedback") }
                </AccessibleButton>
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
