/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    type ReactionsRowButtonTooltipViewSnapshot,
    type ReactionsRowButtonTooltipViewModel as ReactionsRowButtonTooltipViewModelInterface,
} from "@element-hq/web-shared-components";

import { _t } from "../../languageHandler";
import { formatList } from "../../utils/FormattingUtils";
import { unicodeToShortcode } from "../../HtmlUtils";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { REACTION_SHORTCODE_KEY } from "../../components/views/messages/ReactionsRow";

export interface ReactionsRowButtonTooltipViewModelProps {
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
        const { mxEvent, content, reactionEvents, customReactionImagesEnabled } = props;

        const client = MatrixClientPeg.get();
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

    /**
     * Sets the snapshot and emits an update to subscribers.
     */
    private readonly setSnapshot = (): void => {
        this.snapshot.set(ReactionsRowButtonTooltipViewModel.computeSnapshot(this.props));
    };

    /**
     * Updates the properties of the view model and recomputes the snapshot.
     * @param newProps - Partial properties to update
     */
    public setProps(newProps: Partial<ReactionsRowButtonTooltipViewModelProps>): void {
        this.props = { ...this.props, ...newProps };
        this.setSnapshot();
    }
}
