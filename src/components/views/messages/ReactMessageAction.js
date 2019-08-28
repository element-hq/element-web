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

import sdk from '../../../index';

export default class ReactMessageAction extends React.PureComponent {
    static propTypes = {
        mxEvent: PropTypes.object.isRequired,
        // The Relations model from the JS SDK for reactions to `mxEvent`
        reactions: PropTypes.object,
        onFocusChange: PropTypes.func,
    }

    constructor(props) {
        super(props);

        if (props.reactions) {
            props.reactions.on("Relations.add", this.onReactionsChange);
            props.reactions.on("Relations.remove", this.onReactionsChange);
            props.reactions.on("Relations.redaction", this.onReactionsChange);
        }
    }

    onFocusChange = (focused) => {
        if (!this.props.onFocusChange) {
            return;
        }
        this.props.onFocusChange(focused);
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
        // Force a re-render of the tooltip because a change in the reactions
        // set means the event tile's layout may have changed and possibly
        // altered the location where the tooltip should be shown.
        this.forceUpdate();
    }

    render() {
        const ReactionsQuickTooltip = sdk.getComponent('messages.ReactionsQuickTooltip');
        const InteractiveTooltip = sdk.getComponent('elements.InteractiveTooltip');
        const { mxEvent, reactions } = this.props;

        const content = <ReactionsQuickTooltip
            mxEvent={mxEvent}
            reactions={reactions}
        />;

        return <InteractiveTooltip
            content={content}
            onVisibilityChange={this.onFocusChange}
        >
            <span className="mx_MessageActionBar_maskButton mx_MessageActionBar_reactButton" />
        </InteractiveTooltip>;
    }
}
