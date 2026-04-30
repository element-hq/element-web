/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext, useEffect, useMemo, useReducer, type JSX } from "react";
import { ReactionsRowButtonView, ReactionsRowView, useViewModel } from "@element-hq/web-shared-components";
import {
    MatrixEventEvent,
    RelationsEvent,
    type MatrixClient,
    type MatrixEvent,
    type Relations,
} from "matrix-js-sdk/src/matrix";

import RoomContext from "../../../../contexts/RoomContext";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import SettingsStore from "../../../../settings/SettingsStore";
import ContextMenu, { aboveLeftOf } from "../../../structures/ContextMenu";
import ReactionPicker from "../../emojipicker/ReactionPicker";
import { isContentActionable } from "../../../../utils/EventUtils";
import type { ReactionsRowButtonViewModel } from "../../../../viewmodels/room/timeline/event-tile/reactions/ReactionsRowButtonViewModel";
import type {
    ReactionsRowItemInput,
    ReactionsRowViewModel,
    ReactionsRowViewSnapshotWithMenu,
} from "../../../../viewmodels/room/timeline/event-tile/reactions/ReactionsRowViewModel";

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

const getMyReactions = (reactions: Relations | null | undefined, userId?: string): MatrixEvent[] => {
    if (!reactions || !userId) {
        return [];
    }

    const myReactions = reactions.getAnnotationsBySender()?.[userId];
    if (!myReactions) {
        return [];
    }

    return [...myReactions.values()];
};

type UseReactionRowItemInputsArgs = {
    client: MatrixClient;
    mxEvent: MatrixEvent;
    reactions?: Relations | null;
    userId?: string;
    canReact: boolean;
    canSelfRedact: boolean;
    customReactionImagesEnabled?: boolean;
};

// Adapts mutable SDK `Relations` into stable item inputs consumed by the row view model.
function useReactionRowItemsFromRelations({
    client,
    mxEvent,
    reactions,
    userId,
    canReact,
    canSelfRedact,
    customReactionImagesEnabled,
}: UseReactionRowItemInputsArgs): ReactionsRowItemInput[] {
    const [relationsVersion, bumpRelationsVersion] = useReducer((version: number) => version + 1, 0);
    const { reactionGroups, myReactions } = useMemo(() => {
        // Matrix Relations mutates in place, so relationsVersion invalidates these derived lists.
        void relationsVersion;
        return {
            reactionGroups: getReactionGroups(reactions),
            myReactions: getMyReactions(reactions, userId),
        };
    }, [reactions, relationsVersion, userId]);

    useEffect(() => {
        if (!reactions) return;

        const onRelationsChanged = (): void => {
            bumpRelationsVersion();
        };

        reactions.on(RelationsEvent.Add, onRelationsChanged);
        reactions.on(RelationsEvent.Remove, onRelationsChanged);
        reactions.on(RelationsEvent.Redaction, onRelationsChanged);

        return () => {
            reactions.off(RelationsEvent.Add, onRelationsChanged);
            reactions.off(RelationsEvent.Remove, onRelationsChanged);
            reactions.off(RelationsEvent.Redaction, onRelationsChanged);
        };
    }, [reactions]);

    return useMemo(
        () =>
            reactionGroups.map(({ content, events }) => {
                const myReactionEvent = myReactions.find((reactionEvent) => {
                    if (reactionEvent.isRedacted()) {
                        return false;
                    }
                    return reactionEvent.getRelation()?.key === content;
                });

                return {
                    client,
                    mxEvent,
                    content,
                    reactionEvents: events,
                    myReactionEvent,
                    canReact,
                    canSelfRedact,
                    customReactionImagesEnabled,
                };
            }),
        [reactionGroups, myReactions, client, mxEvent, canReact, canSelfRedact, customReactionImagesEnabled],
    );
}

function useUpdateActionableOnDecryption(mxEvent: MatrixEvent, vm: ReactionsRowViewModel): void {
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
}

type ReactionsRowNodeProps = {
    snapshot: ReactionsRowViewSnapshotWithMenu;
    buttonViewModels: ReactionsRowButtonViewModel[];
    mxEvent: MatrixEvent;
    reactions?: Relations | null;
    canReact: boolean;
    vm: ReactionsRowViewModel;
};

function ReactionsRowNode({
    snapshot,
    buttonViewModels,
    mxEvent,
    reactions,
    canReact,
    vm,
}: Readonly<ReactionsRowNodeProps>): JSX.Element | null {
    if (!snapshot.isVisible || !buttonViewModels.length) {
        return null;
    }

    const contextMenu =
        snapshot.isAddReactionMenuOpen && snapshot.addReactionMenuAnchorRect && reactions && canReact ? (
            <ContextMenu
                {...aboveLeftOf(snapshot.addReactionMenuAnchorRect)}
                onFinished={vm.closeAddReactionMenu}
                managed={false}
                focusLock
            >
                <ReactionPicker mxEvent={mxEvent} reactions={reactions} onFinished={vm.closeAddReactionMenu} />
            </ContextMenu>
        ) : undefined;

    return (
        <>
            <ReactionsRowView vm={vm} className="mx_ReactionsRow">
                {buttonViewModels.map((buttonVm) => (
                    <ReactionsRowButtonView key={buttonVm.getSnapshot().content} vm={buttonVm} />
                ))}
            </ReactionsRowView>
            {contextMenu}
        </>
    );
}

/** Props for rendering the event-tile reactions row. */
export interface ReactionsRowProps {
    mxEvent: MatrixEvent;
    reactions?: Relations | null;
    vm: ReactionsRowViewModel;
}

/** Renders reaction buttons and the add-reaction menu for an event tile. */
export function ReactionsRow({ mxEvent, reactions, vm }: Readonly<ReactionsRowProps>): JSX.Element | null {
    const roomContext = useContext(RoomContext);
    const client = useMatrixClientContext();
    const userId = roomContext.room?.client.getUserId() ?? undefined;
    const customReactionImagesEnabled = SettingsStore.getValue("feature_render_reaction_images");
    const itemInputs = useReactionRowItemsFromRelations({
        client,
        mxEvent,
        reactions,
        userId,
        canReact: roomContext.canReact,
        canSelfRedact: roomContext.canSelfRedact,
        customReactionImagesEnabled,
    });

    useEffect(() => {
        vm.setCanReact(roomContext.canReact);
    }, [roomContext.canReact, vm]);

    useUpdateActionableOnDecryption(mxEvent, vm);
    const snapshot = useViewModel(vm);

    useEffect(() => {
        vm.setItems(itemInputs);
    }, [itemInputs, vm]);

    const buttonViewModels = vm.getButtonViewModels();

    return (
        <ReactionsRowNode
            snapshot={snapshot}
            buttonViewModels={buttonViewModels}
            mxEvent={mxEvent}
            reactions={reactions}
            canReact={roomContext.canReact}
            vm={vm}
        />
    );
}
