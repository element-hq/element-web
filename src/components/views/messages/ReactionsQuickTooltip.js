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

    render() {
        const { mxEvent } = this.props;
        const { myReactions } = this.state;
        const ReactionTooltipButton = sdk.getComponent('messages.ReactionTooltipButton');

        const items = [
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

        const buttons = items.map(({ content, title }) => {
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

        return <div className="mx_ReactionsQuickTooltip">
            {buttons}
        </div>;
    }
}
