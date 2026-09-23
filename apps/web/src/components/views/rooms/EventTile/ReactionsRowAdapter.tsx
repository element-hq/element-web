/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useContext, useEffect, useMemo, useState, type JSX } from "react";
import { MatrixEventEvent, type MatrixEvent, type Relations, RelationsEvent } from "matrix-js-sdk/src/matrix";
import { uniqBy } from "lodash";
import {
    ReactionsRowButtonView,
    ReactionsRowView,
    useCreateAutoDisposedViewModel,
    useViewModel,
} from "@element-hq/web-shared-components";

import ContextMenu, { aboveLeftOf } from "../../../structures/ContextMenu";
import ReactionPicker from "../../emojipicker/ReactionPicker";
import RoomContext from "../../../../contexts/RoomContext";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import SettingsStore from "../../../../settings/SettingsStore";
import { isContentActionable } from "../../../../utils/EventUtils";
import { type EventTileViewModel } from "../../../../viewmodels/room/timeline/event-tile/EventTileViewModel";
import { ReactionsRowButtonViewModel } from "../../../../viewmodels/room/timeline/event-tile/reactions/ReactionsRowButtonViewModel";
import { MAX_ITEMS_WHEN_LIMITED } from "../../../../viewmodels/room/timeline/event-tile/reactions/ReactionsRowViewModel";

/**
 * Props for the {@link ReactionsRowButtonAdapter} component.
 */
interface ReactionsRowButtonAdapterProps {
    /** Matrix event whose reaction button is being rendered. */
    mxEvent: MatrixEvent;
    /** Reaction emoji or custom content key for this button. */
    content: string;
    /** Total number of reactions in this group. */
    count: number;
    /** Reaction events belonging to this group. */
    reactionEvents: MatrixEvent[];
    /** The current user's reaction event, if present. */
    myReactionEvent?: MatrixEvent;
    /** Disables interaction when true. */
    disabled?: boolean;
    /** Enables rendering custom reaction images. */
    customReactionImagesEnabled?: boolean;
}

/**
 * Renders a single reaction button within the event tile reaction row.
 */
function ReactionsRowButtonAdapter(props: Readonly<ReactionsRowButtonAdapterProps>): JSX.Element {
    const client = useMatrixClientContext();

    const vm = useCreateAutoDisposedViewModel(
        () =>
            new ReactionsRowButtonViewModel({
                client,
                mxEvent: props.mxEvent,
                content: props.content,
                count: props.count,
                reactionEvents: props.reactionEvents,
                myReactionEvent: props.myReactionEvent,
                disabled: props.disabled,
                customReactionImagesEnabled: props.customReactionImagesEnabled,
            }),
    );

    useEffect(() => {
        vm.setReactionData(props.content, props.reactionEvents, props.customReactionImagesEnabled);
    }, [props.content, props.reactionEvents, props.customReactionImagesEnabled, vm]);

    useEffect(() => {
        vm.setCount(props.count);
    }, [props.count, vm]);

    useEffect(() => {
        vm.setMyReactionEvent(props.myReactionEvent);
    }, [props.myReactionEvent, vm]);

    useEffect(() => {
        vm.setDisabled(props.disabled);
    }, [props.disabled, vm]);

    return <ReactionsRowButtonView vm={vm} />;
}

interface ReactionGroup {
    content: string;
    events: MatrixEvent[];
}

const getReactionGroups = (reactions?: Relations | null): ReactionGroup[] =>
    reactions
        ?.getSortedAnnotationsByKey()
        ?.map(([content, events]) => ({
            content,
            events: [...events],
        }))
        .filter(({ events }) => events.length > 0) ?? [];

const getMyReactions = (reactions: Relations | null | undefined, userId?: string): MatrixEvent[] | null => {
    if (!reactions || !userId) {
        return null;
    }

    const myReactions = reactions.getAnnotationsBySender()?.[userId];
    if (!myReactions) {
        return null;
    }

    return [...myReactions.values()];
};

/**
 * Props for the {@link ReactionsRowAdapter} component.
 */
interface ReactionsRowAdapterProps {
    /** View model backing the event tile reaction row. */
    eventTileViewModel: EventTileViewModel;
    /** Matrix event whose reactions are being rendered. */
    mxEvent: MatrixEvent;
    /** Current reaction relations for the event, if available. */
    reactions?: Relations | null;
}

/**
 * Renders the reaction row and reaction picker for an event tile.
 */
export function ReactionsRowAdapter({
    eventTileViewModel,
    mxEvent,
    reactions,
}: Readonly<ReactionsRowAdapterProps>): JSX.Element | null {
    const roomContext = useContext(RoomContext);
    const userId = roomContext.room?.client.getUserId() ?? undefined;
    const [reactionGroups, setReactionGroups] = useState<ReactionGroup[]>(() => getReactionGroups(reactions));
    const [myReactions, setMyReactions] = useState<MatrixEvent[] | null>(() => getMyReactions(reactions, userId));
    const [menuDisplayed, setMenuDisplayed] = useState(false);
    const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);

    const vm = eventTileViewModel.getReactionsRowViewModel({
        isActionable: isContentActionable(mxEvent),
        reactionGroupCount: reactionGroups.length,
        canReact: roomContext.canReact,
        addReactionButtonActive: false,
    });

    useEffect(() => {
        // This child VM is owned by EventTileViewModel, but scoped to this rendered adapter surface.
        return () => eventTileViewModel.releaseReactionsRowViewModel();
    }, [eventTileViewModel]);

    const openReactionMenu = useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
        setMenuAnchorRect(event.currentTarget.getBoundingClientRect());
        setMenuDisplayed(true);
    }, []);

    const closeReactionMenu = useCallback((): void => {
        setMenuDisplayed(false);
    }, []);

    const updateReactionsState = useCallback((): void => {
        const nextReactionGroups = getReactionGroups(reactions);
        setReactionGroups(nextReactionGroups);
        setMyReactions(getMyReactions(reactions, userId));
        vm.setReactionGroupCount(nextReactionGroups.length);
    }, [reactions, userId, vm]);

    useEffect(() => {
        vm.setActionable(isContentActionable(mxEvent));
    }, [mxEvent, vm]);

    useEffect(() => {
        vm.setCanReact(roomContext.canReact);
        if (!roomContext.canReact && menuDisplayed) {
            setMenuDisplayed(false);
        }
    }, [roomContext.canReact, menuDisplayed, vm]);

    useEffect(() => {
        vm.setAddReactionHandlers({
            onAddReactionClick: openReactionMenu,
            onAddReactionContextMenu: openReactionMenu,
        });
    }, [openReactionMenu, vm]);

    useEffect(() => {
        vm.setAddReactionButtonActive(menuDisplayed);
    }, [menuDisplayed, vm]);

    useEffect(() => {
        updateReactionsState();
    }, [updateReactionsState]);

    useEffect(() => {
        if (!reactions) return;

        reactions.on(RelationsEvent.Add, updateReactionsState);
        reactions.on(RelationsEvent.Remove, updateReactionsState);
        reactions.on(RelationsEvent.Redaction, updateReactionsState);

        return () => {
            reactions.off(RelationsEvent.Add, updateReactionsState);
            reactions.off(RelationsEvent.Remove, updateReactionsState);
            reactions.off(RelationsEvent.Redaction, updateReactionsState);
        };
    }, [reactions, updateReactionsState]);

    useEffect(() => {
        const onDecrypted = (): void => {
            vm.setActionable(isContentActionable(mxEvent));
        };

        if (mxEvent.isBeingDecrypted() || mxEvent.shouldAttemptDecryption()) {
            mxEvent.once(MatrixEventEvent.Decrypted, onDecrypted);
        }

        return () => {
            mxEvent.off(MatrixEventEvent.Decrypted, onDecrypted);
        };
    }, [mxEvent, vm]);

    const snapshot = useViewModel(vm);
    const customReactionImagesEnabled = SettingsStore.getValue("feature_render_reaction_images");
    const items = useMemo((): JSX.Element[] | undefined => {
        const mappedItems = reactionGroups.map(({ content, events }) => {
            // Deduplicate reaction events by sender per Matrix spec.
            const deduplicatedEvents = uniqBy(events, (event: MatrixEvent) => event.getSender());
            const myReactionEvent = myReactions?.find((reactionEvent) => {
                if (reactionEvent.isRedacted()) {
                    return false;
                }
                return reactionEvent.getRelation()?.key === content;
            });

            return (
                <ReactionsRowButtonAdapter
                    key={content}
                    content={content}
                    count={deduplicatedEvents.length}
                    mxEvent={mxEvent}
                    reactionEvents={deduplicatedEvents}
                    myReactionEvent={myReactionEvent}
                    customReactionImagesEnabled={customReactionImagesEnabled}
                    disabled={
                        !roomContext.canReact ||
                        (myReactionEvent && !myReactionEvent.isRedacted() && !roomContext.canSelfRedact)
                    }
                />
            );
        });

        if (!mappedItems.length) {
            return undefined;
        }

        return snapshot.showAllButtonVisible ? mappedItems.slice(0, MAX_ITEMS_WHEN_LIMITED) : mappedItems;
    }, [
        reactionGroups,
        myReactions,
        mxEvent,
        customReactionImagesEnabled,
        roomContext.canReact,
        roomContext.canSelfRedact,
        snapshot.showAllButtonVisible,
    ]);

    if (!snapshot.isVisible || !items?.length) {
        return null;
    }

    let contextMenu: JSX.Element | undefined;
    if (menuDisplayed && menuAnchorRect && reactions && roomContext.canReact) {
        contextMenu = (
            <ContextMenu {...aboveLeftOf(menuAnchorRect)} onFinished={closeReactionMenu} managed={false} focusLock>
                <ReactionPicker mxEvent={mxEvent} reactions={reactions} onFinished={closeReactionMenu} />
            </ContextMenu>
        );
    }

    return (
        <>
            <ReactionsRowView vm={vm} className="mx_ReactionsRow">
                {items}
            </ReactionsRowView>
            {contextMenu}
        </>
    );
}
