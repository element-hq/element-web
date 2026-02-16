/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    type ReactionsRowButtonTooltipViewSnapshot,
    type ReactionsRowButtonTooltipViewModel as ReactionsRowButtonTooltipViewModelInterface,
} from "@element-hq/web-shared-components";

import { _t } from "../../languageHandler";
import { formatList } from "../../utils/FormattingUtils";
import { unicodeToShortcode } from "../../HtmlUtils";
import { REACTION_SHORTCODE_KEY } from "../../components/views/messages/ReactionsRow";

export interface ReactionsRowButtonTooltipViewModelProps {
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
     * A list of Matrix reaction events for this key.
     */
    reactionEvents: MatrixEvent[];
    /**
     * Whether to render custom image reactions.
     */
    customReactionImagesEnabled?: boolean;
}

/**
 * ViewModel for the reactions row button tooltip, providing the formatted sender list and caption.
 */
export class ReactionsRowButtonTooltipViewModel
    extends BaseViewModel<ReactionsRowButtonTooltipViewSnapshot, ReactionsRowButtonTooltipViewModelProps>
    implements ReactionsRowButtonTooltipViewModelInterface
{
    /**
     * Computes the snapshot for the reactions row button tooltip.
     * @param props - The view model properties
     * @returns The computed snapshot with formattedSenders, caption, and children
     */
    private static readonly computeSnapshot = (
        props: ReactionsRowButtonTooltipViewModelProps,
    ): ReactionsRowButtonTooltipViewSnapshot => {
        const { client, mxEvent, content, reactionEvents, customReactionImagesEnabled } = props;

        const room = client?.getRoom(mxEvent.getRoomId());

        if (room) {
            const senders: string[] = [];
            let customReactionName: string | undefined;

            for (const reactionEvent of reactionEvents) {
                const member = room.getMember(reactionEvent.getSender()!);
                const name = member?.name ?? reactionEvent.getSender()!;
                senders.push(name);
                customReactionName =
                    (customReactionImagesEnabled && REACTION_SHORTCODE_KEY.findIn(reactionEvent.getContent())) ||
                    undefined;
            }

            const shortName = unicodeToShortcode(content) || customReactionName;
            const formattedSenders = formatList(senders, 6);
            const caption = shortName ? _t("timeline|reactions|tooltip_caption", { shortName }) : undefined;

            return {
                formattedSenders,
                caption,
            };
        }

        return {
            formattedSenders: undefined,
            caption: undefined,
        };
    };

    public constructor(props: ReactionsRowButtonTooltipViewModelProps) {
        super(props, ReactionsRowButtonTooltipViewModel.computeSnapshot(props));
    }

    private setSnapshotIfChanged(nextSnapshot: ReactionsRowButtonTooltipViewSnapshot): void {
        const currentSnapshot = this.snapshot.current;

        if (
            nextSnapshot.formattedSenders === currentSnapshot.formattedSenders &&
            nextSnapshot.caption === currentSnapshot.caption
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
        this.setSnapshotIfChanged(ReactionsRowButtonTooltipViewModel.computeSnapshot(this.props));
    }

    public setReactionData(content: string, reactionEvents: MatrixEvent[], customReactionImagesEnabled?: boolean): void {
        if (
            this.props.content === content &&
            this.props.reactionEvents === reactionEvents &&
            this.props.customReactionImagesEnabled === customReactionImagesEnabled
        ) {
            return;
        }
        this.props = { ...this.props, content, reactionEvents, customReactionImagesEnabled };
        this.setSnapshotIfChanged(ReactionsRowButtonTooltipViewModel.computeSnapshot(this.props));
    }
}
