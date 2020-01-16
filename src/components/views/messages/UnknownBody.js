/*
Copyright 2015, 2016 OpenMarket Ltd

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
import createReactClass from 'create-react-class';
import { _t } from '../../../languageHandler';

export default createReactClass({
    displayName: 'UnknownBody',

    render: function() {
        let tooltip = _t("Removed or unknown message type");
        if (this.props.mxEvent.isRedacted()) {
            const redactedBecauseUserId = this.props.mxEvent.getUnsigned().redacted_because.sender;
            tooltip = redactedBecauseUserId ?
                _t("Message removed by %(userId)s", { userId: redactedBecauseUserId }) :
                _t("Message removed");
        }

        const text = this.props.mxEvent.getContent().body;
        return (
            <span className="mx_UnknownBody" title={tooltip}>
                { text }
            </span>
        );
    },
});
