/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
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
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import SyntaxHighlight from '../views/elements/SyntaxHighlight';
import {_t} from "../../languageHandler";
import * as sdk from "../../index";


export default createReactClass({
    displayName: 'ViewSource',

    propTypes: {
        content: PropTypes.object.isRequired,
        onFinished: PropTypes.func.isRequired,
        roomId: PropTypes.string.isRequired,
        eventId: PropTypes.string.isRequired,
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        return (
            <BaseDialog className="mx_ViewSource" onFinished={this.props.onFinished} title={_t('View Source')}>
                <div className="mx_ViewSource_label_left">Room ID: { this.props.roomId }</div>
                <div className="mx_ViewSource_label_right">Event ID: { this.props.eventId }</div>
                <div className="mx_ViewSource_label_bottom" />

                <div className="mx_Dialog_content">
                    <SyntaxHighlight className="json">
                        { JSON.stringify(this.props.content, null, 2) }
                    </SyntaxHighlight>
                </div>
            </BaseDialog>
        );
    },
});
