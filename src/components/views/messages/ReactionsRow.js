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

// TODO: Actually load reactions from the timeline
// Since we don't yet load reactions, let's inject some dummy data for testing the UI
// only. The UI assumes these are already sorted into the order we want to present,
// presumably highest vote first.
const SAMPLE_REACTIONS = {
    "👍": 4,
    "👎": 2,
    "🙂": 1,
};

export default class ReactionsRow extends React.PureComponent {
    static propTypes = {
        // The event we're displaying reactions for
        mxEvent: PropTypes.object.isRequired,
    }

    render() {
        const { mxEvent } = this.props;

        if (!isContentActionable(mxEvent)) {
            return null;
        }

        const content = mxEvent.getContent();
        // TODO: Remove this once we load real reactions
        if (!content.body || content.body !== "reactions test") {
            return null;
        }

        const ReactionsRowButton = sdk.getComponent('messages.ReactionsRowButton');
        const items = Object.entries(SAMPLE_REACTIONS).map(([content, count]) => {
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
