/*
Copyright 2019 New Vector Ltd

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

import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import { isContentActionable } from '../../../utils/EventUtils';
import {MatrixClientPeg} from '../../../MatrixClientPeg';

// The maximum number of reactions to initially show on a message.
const MAX_ITEMS_WHEN_LIMITED = 8;

export default class ReactionsRow extends React.PureComponent {
    static propTypes = {
        // The event we're displaying reactions for
        mxEvent: PropTypes.object.isRequired,
        // The Relations model from the JS SDK for reactions to `mxEvent`
        reactions: PropTypes.object,
    }

    constructor(props) {
        super(props);

        if (props.reactions) {
            props.reactions.on("Relations.add", this.onReactionsChange);
            props.reactions.on("Relations.remove", this.onReactionsChange);
            props.reactions.on("Relations.redaction", this.onReactionsChange);
        }

        this.state = {
            myReactions: this.getMyReactions(),
            showAll: false,
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
        // TODO: Call `onHeightChanged` as needed
        this.setState({
            myReactions: this.getMyReactions(),
        });
        // Using `forceUpdate` for the moment, since we know the overall set of reactions
        // has changed (this is triggered by events for that purpose only) and
        // `PureComponent`s shallow state / props compare would otherwise filter this out.
        this.forceUpdate();
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

    onShowAllClick = () => {
        this.setState({
            showAll: true,
        });
    }

    render() {
        const { mxEvent, reactions } = this.props;
        const { myReactions, showAll } = this.state;

        if (!reactions || !isContentActionable(mxEvent)) {
            return null;
        }

        const ReactionsRowButton = sdk.getComponent('messages.ReactionsRowButton');
        let items = reactions.getSortedAnnotationsByKey().map(([content, events]) => {
            const count = events.size;
            if (!count) {
                return null;
            }
            const myReactionEvent = myReactions && myReactions.find(mxEvent => {
                if (mxEvent.isRedacted()) {
                    return false;
                }
                return mxEvent.getRelation().key === content;
            });
            return <ReactionsRowButton
                key={content}
                content={content}
                count={count}
                mxEvent={mxEvent}
                reactionEvents={events}
                myReactionEvent={myReactionEvent}
            />;
        }).filter(item => !!item);

        // Show the first MAX_ITEMS if there are MAX_ITEMS + 1 or more items.
        // The "+ 1" ensure that the "show all" reveals something that takes up
        // more space than the button itself.
        let showAllButton;
        if ((items.length > MAX_ITEMS_WHEN_LIMITED + 1) && !showAll) {
            items = items.slice(0, MAX_ITEMS_WHEN_LIMITED);
            showAllButton = <a
                className="mx_ReactionsRow_showAll"
                href="#"
                onClick={this.onShowAllClick}
            >
                {_t("Show all")}
            </a>;
        }

        return <div
            className="mx_ReactionsRow"
            role="toolbar"
            aria-label={_t("Reactions")}
        >
            {items}
            {showAllButton}
        </div>;
    }
}
