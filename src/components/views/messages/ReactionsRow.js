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
            props.reactions.on("Relations.redaction", this.onReactionsChange);
        }
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.reactions !== nextProps.reactions) {
            nextProps.reactions.on("Relations.add", this.onReactionsChange);
            nextProps.reactions.on("Relations.redaction", this.onReactionsChange);
        }
    }

    componentWillUnmount() {
        if (this.props.reactions) {
            this.props.reactions.removeListener(
                "Relations.add",
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
        this.forceUpdate();
    }

    render() {
        const { mxEvent, reactions } = this.props;

        if (!reactions || !isContentActionable(mxEvent)) {
            return null;
        }

        const ReactionsRowButton = sdk.getComponent('messages.ReactionsRowButton');
        const items = reactions.getSortedAnnotationsByKey().map(([content, events]) => {
            const count = events.size;
            if (!count) {
                return null;
            }
            return <ReactionsRowButton
                key={content}
                content={content}
                count={count}
            />;
        });

        return <div className="mx_ReactionsRow">
            {items}
        </div>;
    }
}
