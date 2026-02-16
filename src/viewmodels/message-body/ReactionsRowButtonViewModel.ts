/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { EventType, type MatrixClient, type MatrixEvent, RelationType } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    type ReactionsRowButtonViewSnapshot,
    type ReactionsRowButtonViewModel as ReactionsRowButtonViewModelInterface,
} from "@element-hq/web-shared-components";

import { mediaFromMxc } from "../../customisations/Media";
import { _t } from "../../languageHandler";
import { formatList } from "../../utils/FormattingUtils";
import dis from "../../dispatcher/dispatcher";
import { REACTION_SHORTCODE_KEY } from "../../components/views/messages/ReactionsRow";
import { ReactionsRowButtonTooltipViewModel } from "./ReactionsRowButtonTooltipViewModel";

export interface ReactionsRowButtonViewModelProps {
    /**
     * The Matrix client instance.
     */
    client: MatrixClient | null;
    /**
     * The event we're displaying reactions for.
     */
    mxEvent: MatrixEvent;
    /**
     * The reaction content / key / emoji.
     */
    content: string;
    /**
     * The count of votes for this key.
     */
    count: number;
    /**
     * A list of Matrix reaction events for this key.
     */
    reactionEvents: MatrixEvent[];
    /**
     * A possible Matrix event if the current user has voted for this type.
     */
    myReactionEvent?: MatrixEvent;
    /**
     * Whether to prevent quick-reactions by clicking on this reaction.
     */
    disabled?: boolean;
    /**
     * Whether to render custom image reactions.
     */
    customReactionImagesEnabled?: boolean;
}

export class ReactionsRowButtonViewModel
    extends BaseViewModel<ReactionsRowButtonViewSnapshot, ReactionsRowButtonViewModelProps>
    implements ReactionsRowButtonViewModelInterface
{
    public readonly tooltipVm: ReactionsRowButtonTooltipViewModel;

    private static readonly computeSnapshot = (
        props: ReactionsRowButtonViewModelProps,
    ): ReactionsRowButtonViewSnapshot => {
        const {
            client,
            mxEvent,
            content,
            count,
            reactionEvents,
            myReactionEvent,
            disabled,
            customReactionImagesEnabled,
        } = props;

        const room = client?.getRoom(mxEvent.getRoomId());
        let ariaLabel: string | undefined;
        let customReactionName: string | undefined;

        if (room) {
            const senders: string[] = [];
            for (const reactionEvent of reactionEvents) {
                const member = room.getMember(reactionEvent.getSender()!);
                senders.push(member?.name || reactionEvent.getSender()!);
                customReactionName =
                    (customReactionImagesEnabled && REACTION_SHORTCODE_KEY.findIn(reactionEvent.getContent())) ||
                    undefined;
            }

            const reactors = formatList(senders, 6);
            if (content) {
                ariaLabel = _t("timeline|reactions|label", {
                    reactors,
                    content: customReactionName || content,
                });
            } else {
                ariaLabel = reactors;
            }
        }

        let imageSrc: string | undefined;
        let imageAlt: string | undefined;
        if (customReactionImagesEnabled && content.startsWith("mxc://")) {
            const resolved = mediaFromMxc(content).srcHttp;
            if (resolved) {
                imageSrc = resolved;
                imageAlt = customReactionName || _t("timeline|reactions|custom_reaction_fallback_label");
            }
        }

        return {
            content,
            count,
            ariaLabel,
            isSelected: !!myReactionEvent,
            isDisabled: disabled,
            imageSrc,
            imageAlt,
        };
    };

    public constructor(props: ReactionsRowButtonViewModelProps) {
        super(props, ReactionsRowButtonViewModel.computeSnapshot(props));
        this.tooltipVm = new ReactionsRowButtonTooltipViewModel({
            client: props.client,
            mxEvent: props.mxEvent,
            content: props.content,
            reactionEvents: props.reactionEvents,
            customReactionImagesEnabled: props.customReactionImagesEnabled,
        });
        this.disposables.track(this.tooltipVm);
    }

    private setSnapshotIfChanged(nextSnapshot: ReactionsRowButtonViewSnapshot): void {
        const currentSnapshot = this.snapshot.current;

        if (
            nextSnapshot.content === currentSnapshot.content &&
            nextSnapshot.count === currentSnapshot.count &&
            nextSnapshot.ariaLabel === currentSnapshot.ariaLabel &&
            nextSnapshot.isSelected === currentSnapshot.isSelected &&
            nextSnapshot.isDisabled === currentSnapshot.isDisabled &&
            nextSnapshot.imageSrc === currentSnapshot.imageSrc &&
            nextSnapshot.imageAlt === currentSnapshot.imageAlt
        ) {
            return;
        }

        this.snapshot.set(nextSnapshot);
    }

    public setContext(client: MatrixClient | null, mxEvent: MatrixEvent): void {
        if (this.props.client === client && this.props.mxEvent === mxEvent) {
            return;
        }
        this.props = { ...this.props, client, mxEvent };

        this.tooltipVm.setContext(client, mxEvent);
        this.setSnapshotIfChanged(ReactionsRowButtonViewModel.computeSnapshot(this.props));
    }

    public setReactionData(
        content: string,
        reactionEvents: MatrixEvent[],
        customReactionImagesEnabled?: boolean,
    ): void {
        if (
            this.props.content === content &&
            this.props.reactionEvents === reactionEvents &&
            this.props.customReactionImagesEnabled === customReactionImagesEnabled
        ) {
            return;
        }
        this.props = { ...this.props, content, reactionEvents, customReactionImagesEnabled };

        this.tooltipVm.setReactionData(content, reactionEvents, customReactionImagesEnabled);
        this.setSnapshotIfChanged(ReactionsRowButtonViewModel.computeSnapshot(this.props));
    }

    public setCount(count: number): void {
        if (this.props.count === count) {
            return;
        }
        this.props = { ...this.props, count };
        this.snapshot.merge({ count });
    }

    public setMyReactionEvent(myReactionEvent?: MatrixEvent): void {
        if (this.props.myReactionEvent === myReactionEvent) {
            return;
        }
        this.props = { ...this.props, myReactionEvent };
        this.snapshot.merge({ isSelected: !!myReactionEvent });
    }

    public setDisabled(disabled?: boolean): void {
        if (this.props.disabled === disabled) {
            return;
        }
        this.props = { ...this.props, disabled };
        this.snapshot.merge({ isDisabled: disabled });
    }

    public onClick = (): void => {
        const { client, mxEvent, myReactionEvent, content, disabled } = this.props;
        if (!client || disabled) {
            return;
        }

        if (myReactionEvent) {
            client.redactEvent(mxEvent.getRoomId()!, myReactionEvent.getId()!);
            return;
        }

        client.sendEvent(mxEvent.getRoomId()!, EventType.Reaction, {
            "m.relates_to": {
                rel_type: RelationType.Annotation,
                event_id: mxEvent.getId()!,
                key: content,
            },
        });
        dis.dispatch({ action: "message_sent" });
    };
}
