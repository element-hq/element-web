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

import sdk from '../../../index';
import { isContentActionable } from '../../../utils/EventUtils';
import MatrixClientPeg from '../../../MatrixClientPeg';

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

    render() {
        const { mxEvent, reactions } = this.props;
        const { myReactions } = this.state;

        if (!reactions || !isContentActionable(mxEvent)) {
            return null;
        }

        const ReactionsRowButton = sdk.getComponent('messages.ReactionsRowButton');
        const items = reactions.getSortedAnnotationsByKey().map(([content, events]) => {
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
                mxEvent={mxEvent}
                reactionEvents={events}
                myReactionEvent={myReactionEvent}
            />;
        });

        return <div className="mx_ReactionsRow">
            {items}
        </div>;
    }
}
