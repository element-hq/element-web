/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {type JSX, type PropsWithChildren } from "react";
import React from "react";
import { Tooltip } from "@vector-im/compound-web";

import { useI18n } from "../../utils/i18nContext";
import { formatList } from "../../../utils/FormattingUtils";
import { REACTION_SHORTCODE_KEY } from "./ReactionsRow";
import { unicodeToShortcode } from "../../../HtmlUtils";
import { type ViewModel } from "../../viewmodel/ViewModel";
import { useViewModel } from "../../useViewModel";


interface IProps {
    /**
     * The event we're displaying reactions for
     */
    mxEvent: MatrixEvent;
    /**
     * The reaction content / key / emoji
     */
    content: string;
    /**
     * A list of Matrix reaction events for this key
     */
    reactionEvents: MatrixEvent[];
    /**
     * Whether to render custom image reactions
     */
    customReactionImagesEnabled?: boolean;
}


export interface ReactionsRowButtonTooltipViewSnapshot {

    /**
     * Props for the component.
    */
    Props: IProps

}

export type ReactionsRowButtonTooltipViewModel = ViewModel<ReactionsRowButtonTooltipViewSnapshot>;

interface ReactionsRowButtonTooltipViewProps {
    /**
     * The view model for the disambiguated profile.
     */
    vm: ReactionsRowButtonTooltipViewModel;
    
}


export function ReactionsRowButtonTooltip({ vm }: Readonly<ReactionsRowButtonTooltipViewProps>): JSX.Element {
    const { mxEvent, content, reactionEvents, customReactionImagesEnabled, children } = useViewModel(vm);

    
    const { translate: _t } = useI18n();
    const room = mxEvent.getRoomId();
    if (room) {
            const senders: string[] = [];
            let customReactionName: string | undefined;
            for (const reactionEvent of reactionEvents) {
                const member = room.getMember(reactionEvent.getSender()!);
                const name = member?.name ?? reactionEvent.getSender()!;
                senders.push(name);
                customReactionName =
                    (customReactionImagesEnabled &&
                        REACTION_SHORTCODE_KEY.findIn(reactionEvent.getContent())) ||
                    undefined;
            }
            const shortName = unicodeToShortcode(content) || customReactionName;
            const formattedSenders = formatList(senders, 6);
            const caption = shortName ? _t("timeline|reactions|tooltip_caption", { shortName }) : undefined;

            return (
                <Tooltip description={formattedSenders} caption={caption} placement="right">
                    {children}
                </Tooltip>
            );
        }
    return <>{children}</>;
};
