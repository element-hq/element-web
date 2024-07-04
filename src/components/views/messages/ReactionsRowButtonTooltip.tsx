/*
Copyright 2019, 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import { unicodeToShortcode } from "../../../HtmlUtils";
import { _t } from "../../../languageHandler";
import { formatList } from "../../../utils/FormattingUtils";
import Tooltip from "../elements/Tooltip";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { REACTION_SHORTCODE_KEY } from "./ReactionsRow";
interface IProps {
    // The event we're displaying reactions for
    mxEvent: MatrixEvent;
    // The reaction content / key / emoji
    content: string;
    // A list of Matrix reaction events for this key
    reactionEvents: MatrixEvent[];
    visible: boolean;
    // Whether to render custom image reactions
    customReactionImagesEnabled?: boolean;
}

export default class ReactionsRowButtonTooltip extends React.PureComponent<IProps> {
    public static contextType = MatrixClientContext;
    public context!: React.ContextType<typeof MatrixClientContext>;

    public render(): React.ReactNode {
        const { content, reactionEvents, mxEvent, visible } = this.props;

        const room = this.context.getRoom(mxEvent.getRoomId());
        let tooltipLabel: JSX.Element | undefined;
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
            tooltipLabel = (
                <div>
                    {_t(
                        "timeline|reactions|tooltip",
                        {
                            shortName,
                        },
                        {
                            reactors: () => {
                                return <div className="mx_Tooltip_title">{formatList(senders, 6)}</div>;
                            },
                            reactedWith: (sub) => {
                                if (!shortName) {
                                    return null;
                                }
                                return <div className="mx_Tooltip_sub">{sub}</div>;
                            },
                        },
                    )}
                </div>
            );
        }

        let tooltip: JSX.Element | undefined;
        if (tooltipLabel) {
            tooltip = <Tooltip visible={visible} label={tooltipLabel} />;
        }

        return tooltip;
    }
}
