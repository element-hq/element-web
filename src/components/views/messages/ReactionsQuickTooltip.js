/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import PropTypes from 'prop-types';

import { _t } from '../../../languageHandler';
import sdk from '../../../index';
import MatrixClientPeg from '../../../MatrixClientPeg';
import { unicodeToShortcode } from '../../../HtmlUtils';

export default class ReactionsQuickTooltip extends React.PureComponent {
    static propTypes = {
        mxEvent: PropTypes.object.isRequired,
        // The Relations model from the JS SDK for reactions to `mxEvent`
        reactions: PropTypes.object,
    };

    constructor(props) {
        super(props);

        if (props.reactions) {
            props.reactions.on("Relations.add", this.onReactionsChange);
            props.reactions.on("Relations.remove", this.onReactionsChange);
            props.reactions.on("Relations.redaction", this.onReactionsChange);
        }

        this.state = {
            hoveredItem: null,
            myReactions: this.getMyReactions(),
        };
    }

    componentDidUpdate(prevProps) {
        if (prevProps.reactions !== this.props.reactions) {
            this.props.reactions.on("Relations.add", this.onReactionsChange);
            this.props.reactions.on("Relations.remove", this.onReactionsChange);
            this.props.reactions.on("Relations.redaction", this.onReactionsChange);
            this.onReactionsChange();
        }
    }

    componentWillUnmount() {
        if (this.props.reactions) {
            this.props.reactions.removeListener(
                "Relations.add",
                this.onReactionsChange,
            );
            this.props.reactions.removeListener(
                "Relations.remove",
                this.onReactionsChange,
            );
            this.props.reactions.removeListener(
                "Relations.redaction",
                this.onReactionsChange,
            );
        }
    }

    onReactionsChange = () => {
        this.setState({
            myReactions: this.getMyReactions(),
        });
    }

    getMyReactions() {
        const reactions = this.props.reactions;
        if (!reactions) {
            return null;
        }
        const userId = MatrixClientPeg.get().getUserId();
        const myReactions = reactions.getAnnotationsBySender()[userId];
        if (!myReactions) {
            return null;
        }
        return [...myReactions.values()];
    }

    onMouseOver = (ev) => {
        const { key } = ev.target.dataset;
        const item = this.items.find(({ content }) => content === key);
        this.setState({
            hoveredItem: item,
        });
    }

    onMouseOut = (ev) => {
        this.setState({
            hoveredItem: null,
        });
    }

    get items() {
        return [
            {
                content: "👍",
                title: _t("Agree"),
            },
            {
                content: "👎",
                title: _t("Disagree"),
            },
            {
                content: "😄",
                title: _t("Happy"),
            },
            {
                content: "🎉",
                title: _t("Party Popper"),
            },
            {
                content: "😕",
                title: _t("Confused"),
            },
            {
                content: "❤️",
                title: _t("Heart"),
            },
            {
                content: "🚀",
                title: _t("Rocket"),
            },
            {
                content: "👀",
                title: _t("Eyes"),
            },
        ];
    }

    render() {
        const { mxEvent } = this.props;
        const { myReactions, hoveredItem } = this.state;
        const ReactionTooltipButton = sdk.getComponent('messages.ReactionTooltipButton');

        const buttons = this.items.map(({ content, title }) => {
            const myReactionEvent = myReactions && myReactions.find(mxEvent => {
                if (mxEvent.isRedacted()) {
                    return false;
                }
                return mxEvent.getRelation().key === content;
            });

            return <ReactionTooltipButton
                key={content}
                content={content}
                title={title}
                mxEvent={mxEvent}
                myReactionEvent={myReactionEvent}
            />;
        });

        let label = " "; // non-breaking space to keep layout the same when empty
        if (hoveredItem) {
            const { content, title } = hoveredItem;

            let shortcodeLabel;
            const shortcode = unicodeToShortcode(content);
            if (shortcode) {
                shortcodeLabel = <span className="mx_ReactionsQuickTooltip_shortcode">
                    {shortcode}
                </span>;
            }

            label = <div className="mx_ReactionsQuickTooltip_label">
                <span className="mx_ReactionsQuickTooltip_title">
                    {title}
                </span>
                {shortcodeLabel}
            </div>;
        }

        return <div className="mx_ReactionsQuickTooltip"
            onMouseOver={this.onMouseOver}
            onMouseOut={this.onMouseOut}
        >
            <div className="mx_ReactionsQuickTooltip_buttons">
                {buttons}
            </div>
            {label}
        </div>;
    }
}
