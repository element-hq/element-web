/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { PropsWithChildren } from "react";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import {
    CustomComponentLifecycle,
    CustomComponentOpts,
} from "@matrix-org/react-sdk-module-api/lib/lifecycles/CustomComponentLifecycle";
import { Tooltip } from "@vector-im/compound-web";

import { unicodeToShortcode } from "../../../HtmlUtils";
import { _t } from "../../../languageHandler";
import { formatList } from "../../../utils/FormattingUtils";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { REACTION_SHORTCODE_KEY } from "./ReactionsRow";
import { ModuleRunner } from "../../../modules/ModuleRunner";
interface IProps {
    // The event we're displaying reactions for
    mxEvent: MatrixEvent;
    // The reaction content / key / emoji
    content: string;
    // A list of Matrix reaction events for this key
    reactionEvents: MatrixEvent[];
    // Whether to render custom image reactions
    customReactionImagesEnabled?: boolean;
}

export default class ReactionsRowButtonTooltip extends React.PureComponent<PropsWithChildren<IProps>> {
    public static contextType = MatrixClientContext;
    declare public context: React.ContextType<typeof MatrixClientContext>;

    public render(): React.ReactNode {
        const { content, reactionEvents, mxEvent, children } = this.props;

        const room = this.context.getRoom(mxEvent.getRoomId());
        if (room) {
            const senders: string[] = [];
            let customReactionName: string | undefined;
            for (const reactionEvent of reactionEvents) {
                const member = room.getMember(reactionEvent.getSender()!);
                const name = member?.name ?? reactionEvent.getSender()!;
                senders.push(name);
                customReactionName =
                    (this.props.customReactionImagesEnabled &&
                        REACTION_SHORTCODE_KEY.findIn(reactionEvent.getContent())) ||
                    undefined;
            }
            const shortName = unicodeToShortcode(content) || customReactionName;

            // Line 👇is Verji specific. If we wish to use upstream only we must implement CustomComponentLifecycle.ReactionsRowButtonTooltip
            const formattedSenders = formatList(senders, 50);

            const caption = shortName ? _t("timeline|reactions|tooltip_caption", { shortName }) : undefined;

            const customReactionButtonTooltip = { CustomComponent: React.Fragment };
            ModuleRunner.instance.invoke(
                CustomComponentLifecycle.ReactionsRowButtonTooltip,
                customReactionButtonTooltip as CustomComponentOpts,
            );

            return (
                <customReactionButtonTooltip.CustomComponent>
                    <Tooltip description={formattedSenders} caption={caption} placement="right">
                        {children}
                    </Tooltip>
                </customReactionButtonTooltip.CustomComponent>
            );
        }

        return children;
    }
}
