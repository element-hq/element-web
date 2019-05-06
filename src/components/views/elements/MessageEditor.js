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
import sdk from '../../../index';
import {_t} from '../../../languageHandler';
import PropTypes from 'prop-types';
import dis from '../../../dispatcher';
import {MatrixEvent, MatrixClient} from 'matrix-js-sdk';

export default class MessageEditor extends React.Component {
    static propTypes = {
        // the latest event in this chain of replies
        event: PropTypes.instanceOf(MatrixEvent).isRequired,
        // called when the ReplyThread contents has changed, including EventTiles thereof
        // onHeightChanged: PropTypes.func.isRequired,
    };

    static contextTypes = {
        matrixClient: PropTypes.instanceOf(MatrixClient).isRequired,
    };

    constructor(props, context) {
        super(props, context);
        this.state = {};
        this._onCancelClicked = this._onCancelClicked.bind(this);
    }

    _onCancelClicked() {
        dis.dispatch({action: "edit_event", event: null});
    }

    render() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        return <div className="mx_MessageEditor">
                <div className="editor" contentEditable="true">
                    {this.props.event.getContent().body}
                </div>
                <div className="buttons">
                    <AccessibleButton onClick={this._onCancelClicked}>{_t("Cancel")}</AccessibleButton>
                </div>
            </div>;
    }
}
