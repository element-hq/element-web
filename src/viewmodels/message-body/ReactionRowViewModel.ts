/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ReactNode } from "react";
import { uniqBy } from "lodash";
import { type MatrixEvent, MatrixEventEvent, type Relations, RelationsEvent, type Room } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    type ReactionRowViewSnapshot,
    type ReactionRowViewModel as ReactionRowViewModelInterface,
} from "@element-hq/web-shared-components";

import { _t } from "../../languageHandler";
import { isContentActionable } from "../../utils/EventUtils";
import ReactionsRowButton from "../../components/views/messages/ReactionsRowButton";

const MAX_ITEMS_WHEN_LIMITED = 8;
const RELATIONS_EVENTS = [RelationsEvent.Add, RelationsEvent.Remove, RelationsEvent.Redaction];

export interface ReactionRowViewModelProps {
    /**
     * The event being rendered.
     */
    mxEvent: MatrixEvent;
    /**
     * Relations model for reactions on this event.
     */
    reactions?: Relations | null;
    /**
     * Current room context.
     */
    room?: Room;
    /**
     * Whether the user is allowed to react.
     */
    canReact: boolean;
    /**
     * Whether the user can redact their own events.
     */
    canSelfRedact: boolean;
    /**
     * Whether custom reaction images are enabled.
     */
    customReactionImagesEnabled?: boolean;
    /**
     * Optional add-reaction button.
     */
    addReactionButton?: ReactNode;
}

export class ReactionRowViewModel
    extends BaseViewModel<ReactionRowViewSnapshot, ReactionRowViewModelProps>
    implements ReactionRowViewModelInterface
{
    private showAll = false;
    private listenedEvent?: MatrixEvent;
    private listenedReactions?: Relations | null;

    private static readonly createHiddenSnapshot = (props: ReactionRowViewModelProps): ReactionRowViewSnapshot => ({
        isVisible: false,
        items: [],
        showAllVisible: false,
        showAllLabel: _t("action|show_all"),
        toolbarAriaLabel: _t("common|reactions"),
        addReactionButton: props.canReact ? props.addReactionButton : undefined,
    });

    private static readonly computeSnapshot = (
        props: ReactionRowViewModelProps,
        showAll: boolean,
    ): ReactionRowViewSnapshot => {
        const { mxEvent, reactions, room, canReact, canSelfRedact, customReactionImagesEnabled, addReactionButton } = props;

        if (!reactions || !isContentActionable(mxEvent)) {
            return ReactionRowViewModel.createHiddenSnapshot(props);
        }

        const userId = room?.client.getUserId();
        const myReactions = userId ? reactions.getAnnotationsBySender()?.[userId] : undefined;

        const items: ReactNode[] = [];
        for (const [content, events] of reactions.getSortedAnnotationsByKey() ?? []) {
            if (!events.size) {
                continue;
            }

            // Deduplicate reaction events by sender per the matrix annotation behaviour.
            const deduplicatedEvents = uniqBy([...events], (event) => event.getSender());
            const myReactionEvent = myReactions
                ? [...myReactions.values()].find((event) => !event.isRedacted() && event.getRelation()?.key === content)
                : undefined;

            items.push(
                React.createElement(ReactionsRowButton, {
                    key: content,
                    content,
                    count: deduplicatedEvents.length,
                    mxEvent,
                    reactionEvents: deduplicatedEvents,
                    myReactionEvent,
                    customReactionImagesEnabled,
                    disabled: !canReact || (!!myReactionEvent && !myReactionEvent.isRedacted() && !canSelfRedact),
                }),
            );
        }

        if (!items.length) {
            return ReactionRowViewModel.createHiddenSnapshot(props);
        }

        let displayedItems = items;
        let showAllVisible = false;
        if (items.length > MAX_ITEMS_WHEN_LIMITED + 1 && !showAll) {
            displayedItems = items.slice(0, MAX_ITEMS_WHEN_LIMITED);
            showAllVisible = true;
        }

        return {
            isVisible: true,
            items: displayedItems,
            showAllVisible,
            showAllLabel: _t("action|show_all"),
            toolbarAriaLabel: _t("common|reactions"),
            addReactionButton: canReact ? addReactionButton : undefined,
        };
    };

    public constructor(props: ReactionRowViewModelProps) {
        super(props, ReactionRowViewModel.computeSnapshot(props, false));
        this.attachListeners();
    }

    public setProps(newProps: Partial<ReactionRowViewModelProps>): void {
        const previousEvent = this.props.mxEvent;
        const previousReactions = this.props.reactions;

        this.props = { ...this.props, ...newProps };

        if (previousEvent !== this.props.mxEvent) {
            this.showAll = false;
        }

        if (previousEvent !== this.props.mxEvent || previousReactions !== this.props.reactions) {
            this.detachListeners();
            this.attachListeners();
        }

        this.setSnapshot();
    }

    public onShowAllClick = (): void => {
        if (this.showAll) {
            return;
        }
        this.showAll = true;
        this.setSnapshot();
    };

    public override dispose(): void {
        this.detachListeners();
        super.dispose();
    }

    private readonly onDecrypted = (): void => {
        this.setSnapshot();
    };

    private readonly onReactionsChange = (): void => {
        this.setSnapshot();
    };

    private readonly attachListeners = (): void => {
        if (this.props.mxEvent.isBeingDecrypted() || this.props.mxEvent.shouldAttemptDecryption()) {
            this.props.mxEvent.on(MatrixEventEvent.Decrypted, this.onDecrypted);
            this.listenedEvent = this.props.mxEvent;
        }

        if (this.props.reactions) {
            for (const relationEvent of RELATIONS_EVENTS) {
                this.props.reactions.on(relationEvent, this.onReactionsChange);
            }
            this.listenedReactions = this.props.reactions;
        }
    };

    private readonly detachListeners = (): void => {
        if (this.listenedEvent) {
            this.listenedEvent.off(MatrixEventEvent.Decrypted, this.onDecrypted);
            this.listenedEvent = undefined;
        }

        if (this.listenedReactions) {
            for (const relationEvent of RELATIONS_EVENTS) {
                this.listenedReactions.off(relationEvent, this.onReactionsChange);
            }
            this.listenedReactions = undefined;
        }
    };

    private readonly setSnapshot = (): void => {
        this.snapshot.set(ReactionRowViewModel.computeSnapshot(this.props, this.showAll));
    };
}
