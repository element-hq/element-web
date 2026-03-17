/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useContext, useEffect, useMemo, useState, type JSX } from "react";
import { ReactionsRowButtonView, ReactionsRowView, useCreateAutoDisposedViewModel, useViewModel } from "@element-hq/web-shared-components";
import { uniqBy } from "lodash";
import { MatrixEventEvent, RelationsEvent, type MatrixEvent, type Relations } from "matrix-js-sdk/src/matrix";

import RoomContext from "../../../../contexts/RoomContext";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import SettingsStore from "../../../../settings/SettingsStore";
import ContextMenu, { aboveLeftOf } from "../../../structures/ContextMenu";
import ReactionPicker from "../../emojipicker/ReactionPicker";
import { isContentActionable } from "../../../../utils/EventUtils";
import { ReactionsRowButtonViewModel } from "../../../../viewmodels/message-body/ReactionsRowButtonViewModel";
import { MAX_ITEMS_WHEN_LIMITED, ReactionsRowViewModel } from "../../../../viewmodels/message-body/ReactionsRowViewModel";

interface ReactionsRowButtonItemProps {
    mxEvent: MatrixEvent;
    content: string;
    count: number;
    reactionEvents: MatrixEvent[];
    myReactionEvent?: MatrixEvent;
    disabled?: boolean;
    customReactionImagesEnabled?: boolean;
}

function ReactionsRowButtonItem(props: Readonly<ReactionsRowButtonItemProps>): JSX.Element {
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

export interface ReactionsRowProps {
    mxEvent: MatrixEvent;
    reactions?: Relations | null;
}

export function ReactionsRow({ mxEvent, reactions }: Readonly<ReactionsRowProps>): JSX.Element | null {
    const roomContext = useContext(RoomContext);
    const userId = roomContext.room?.client.getUserId() ?? undefined;
    const [menuDisplayed, setMenuDisplayed] = useState(false);
    const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
    const [reactionGroups, setReactionGroups] = useState<ReactionGroup[]>(() => getReactionGroups(reactions));
    const [myReactions, setMyReactions] = useState<MatrixEvent[] | null>(() => getMyReactions(reactions, userId));

    const vm = useCreateAutoDisposedViewModel(
        () =>
            new ReactionsRowViewModel({
                isActionable: isContentActionable(mxEvent),
                reactionGroupCount: reactionGroups.length,
                canReact: roomContext.canReact,
                addReactionButtonActive: false,
            }),
    );

    const openReactionMenu = useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
        setMenuAnchorRect(event.currentTarget.getBoundingClientRect());
        setMenuDisplayed(true);
    }, []);

    const closeReactionMenu = useCallback((): void => {
        setMenuDisplayed(false);
    }, []);

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
        vm.setReactionGroupCount(reactionGroups.length);
    }, [reactionGroups.length, vm]);

    useEffect(() => {
        setReactionGroups(getReactionGroups(reactions));
        setMyReactions(getMyReactions(reactions, userId));
    }, [reactions, userId]);

    useEffect(() => {
        if (!reactions) return;

        const onRelationsChanged = (): void => {
            setReactionGroups(getReactionGroups(reactions));
            setMyReactions(getMyReactions(reactions, userId));
        };

        reactions.on(RelationsEvent.Add, onRelationsChanged);
        reactions.on(RelationsEvent.Remove, onRelationsChanged);
        reactions.on(RelationsEvent.Redaction, onRelationsChanged);

        return () => {
            reactions.off(RelationsEvent.Add, onRelationsChanged);
            reactions.off(RelationsEvent.Remove, onRelationsChanged);
            reactions.off(RelationsEvent.Redaction, onRelationsChanged);
        };
    }, [reactions, userId]);

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
            const deduplicatedEvents = uniqBy(events, (event: MatrixEvent) => event.getSender());
            const myReactionEvent = myReactions?.find((reactionEvent) => {
                if (reactionEvent.isRedacted()) {
                    return false;
                }
                return reactionEvent.getRelation()?.key === content;
            });

            return (
                <ReactionsRowButtonItem
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

    const contextMenu =
        menuDisplayed && menuAnchorRect && reactions && roomContext.canReact ? (
            <ContextMenu {...aboveLeftOf(menuAnchorRect)} onFinished={closeReactionMenu} managed={false} focusLock>
                <ReactionPicker mxEvent={mxEvent} reactions={reactions} onFinished={closeReactionMenu} />
            </ContextMenu>
        ) : undefined;

    return (
        <>
            <ReactionsRowView vm={vm} className="mx_ReactionsRow">
                {items}
            </ReactionsRowView>
            {contextMenu}
        </>
    );
}
