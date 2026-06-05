/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { MatrixEventEvent, type MatrixEvent, type Relations, RelationsEvent } from "matrix-js-sdk/src/matrix";
import { uniqBy } from "lodash";
import {
    ReactionsRowButtonView,
    ReactionsRowView,
    useViewModel,
    type ReactionsRowViewSnapshot,
} from "@element-hq/web-shared-components";

import ContextMenu, { aboveLeftOf } from "../../../structures/ContextMenu";
import ReactionPicker from "../../emojipicker/ReactionPicker";
import RoomContext from "../../../../contexts/RoomContext";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import SettingsStore from "../../../../settings/SettingsStore";
import { isContentActionable } from "../../../../utils/EventUtils";
import { ReactionsRowButtonViewModel } from "../../../../viewmodels/room/timeline/event-tile/reactions/ReactionsRowButtonViewModel";
import { MAX_ITEMS_WHEN_LIMITED } from "../../../../viewmodels/room/timeline/event-tile/reactions/ReactionsRowViewModel";
import { type ReactionsRowViewModel } from "../../../../viewmodels/room/timeline/event-tile/reactions/ReactionsRowViewModel";

interface ReactionsRowContextMenuProps {
    mxEvent: MatrixEvent;
    reactions?: Relations | null;
    menuDisplayed: boolean;
    menuAnchorRect: DOMRect | null;
    closeReactionMenu: () => void;
}

function ReactionsRowContextMenu({
    mxEvent,
    reactions,
    menuDisplayed,
    menuAnchorRect,
    closeReactionMenu,
}: Readonly<ReactionsRowContextMenuProps>): JSX.Element | null {
    if (!menuDisplayed || !menuAnchorRect || !reactions) {
        return null;
    }

    return (
        <ContextMenu {...aboveLeftOf(menuAnchorRect)} onFinished={closeReactionMenu} managed={false} focusLock>
            <ReactionPicker mxEvent={mxEvent} reactions={reactions} onFinished={closeReactionMenu} />
        </ContextMenu>
    );
}

interface ReactionsRowContentProps {
    vm: ReactionsRowViewModel;
    snapshot: ReactionsRowViewSnapshot;
    items?: JSX.Element[];
    contextMenu?: JSX.Element;
}

function ReactionsRowContent({
    vm,
    snapshot,
    items,
    contextMenu,
}: Readonly<ReactionsRowContentProps>): JSX.Element | null {
    if (!snapshot.isVisible || !items?.length) {
        return null;
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
    /** View model owned by the parent event tile container. */
    vm: ReactionsRowViewModel;
    /** Matrix event whose reactions are being rendered. */
    mxEvent: MatrixEvent;
    /** Current reaction relations for the event, if available. */
    reactions?: Relations | null;
}

/**
 * Renders the reaction row and reaction picker for an event tile.
 */
export function ReactionsRowAdapter({
    vm,
    mxEvent,
    reactions,
}: Readonly<ReactionsRowAdapterProps>): JSX.Element | null {
    const client = useMatrixClientContext();
    const roomContext = useContext(RoomContext);
    const userId = roomContext.room?.client.getUserId() ?? undefined;
    const [reactionGroups, setReactionGroups] = useState<ReactionGroup[]>(() => getReactionGroups(reactions));
    const [myReactions, setMyReactions] = useState<MatrixEvent[] | null>(() => getMyReactions(reactions, userId));
    const [menuDisplayed, setMenuDisplayed] = useState(false);
    const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
    const buttonVmMapRef = useRef(new Map<string, ReactionsRowButtonViewModel>());
    const buttonVmContextRef = useRef<{ client: typeof client; mxEvent: MatrixEvent } | null>(null);

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
        const contextChanged =
            !buttonVmContextRef.current ||
            buttonVmContextRef.current.client !== client ||
            buttonVmContextRef.current.mxEvent !== mxEvent;

        if (contextChanged) {
            for (const buttonVm of buttonVmMapRef.current.values()) {
                buttonVm.dispose();
            }
            buttonVmMapRef.current.clear();
            buttonVmContextRef.current = { client, mxEvent };
        }

        const nextKeys = new Set<string>();
        const mappedItems = reactionGroups.map(({ content, events }) => {
            // Deduplicate reaction events by sender per Matrix spec.
            const deduplicatedEvents = uniqBy(events, (event: MatrixEvent) => event.getSender());
            const myReactionEvent = myReactions?.find((reactionEvent) => {
                if (reactionEvent.isRedacted()) {
                    return false;
                }
                return reactionEvent.getRelation()?.key === content;
            });
            const disabled =
                !roomContext.canReact ||
                (myReactionEvent && !myReactionEvent.isRedacted() && !roomContext.canSelfRedact);

            let buttonVm = buttonVmMapRef.current.get(content);
            if (!buttonVm) {
                buttonVm = new ReactionsRowButtonViewModel({
                    client,
                    mxEvent,
                    content,
                    count: deduplicatedEvents.length,
                    reactionEvents: deduplicatedEvents,
                    myReactionEvent,
                    disabled,
                    customReactionImagesEnabled,
                });
                buttonVmMapRef.current.set(content, buttonVm);
            } else {
                buttonVm.setReactionData(content, deduplicatedEvents, customReactionImagesEnabled);
                buttonVm.setCount(deduplicatedEvents.length);
                buttonVm.setMyReactionEvent(myReactionEvent);
                buttonVm.setDisabled(disabled);
            }

            nextKeys.add(content);

            return <ReactionsRowButtonView key={content} vm={buttonVm} />;
        });

        for (const [content, buttonVm] of buttonVmMapRef.current) {
            if (!nextKeys.has(content)) {
                buttonVm.dispose();
                buttonVmMapRef.current.delete(content);
            }
        }

        if (!mappedItems.length) {
            return undefined;
        }

        return snapshot.showAllButtonVisible ? mappedItems.slice(0, MAX_ITEMS_WHEN_LIMITED) : mappedItems;
    }, [
        client,
        reactionGroups,
        myReactions,
        mxEvent,
        customReactionImagesEnabled,
        roomContext.canReact,
        roomContext.canSelfRedact,
        snapshot.showAllButtonVisible,
    ]);

    useEffect(
        () => () => {
            for (const buttonVm of buttonVmMapRef.current.values()) {
                buttonVm.dispose();
            }
            buttonVmMapRef.current.clear();
        },
        [],
    );

    const contextMenu =
        roomContext.canReact && menuDisplayed && menuAnchorRect && reactions ? (
            <ReactionsRowContextMenu
                mxEvent={mxEvent}
                reactions={reactions}
                menuDisplayed={menuDisplayed}
                menuAnchorRect={menuAnchorRect}
                closeReactionMenu={closeReactionMenu}
            />
        ) : undefined;

    return <ReactionsRowContent vm={vm} snapshot={snapshot} items={items} contextMenu={contextMenu} />;
}
