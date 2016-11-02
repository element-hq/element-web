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

'use strict';

var React = require('react');
var sdk = require('matrix-react-sdk');
import Modal from 'matrix-react-sdk/lib/Modal';
import PlatformPeg from 'matrix-react-sdk/lib/PlatformPeg';

/**
 * Check a version string is compatible with the Changelog
 * dialog
 */
function checkVersion(ver) {
    const parts = ver.split('-');
    return parts[0] == 'vector' && parts[2] == 'react' && parts[4] == 'js';
}

export default function NewVersionBar(props) {
    const onChangelogClicked = () => {
        if (props.releaseNotes) {
            const QuestionDialog = sdk.getComponent('dialogs.QuestionDialog');
            Modal.createDialog(QuestionDialog, {
                title: "What's New",
                description: <pre className="changelog_text">{props.releaseNotes}</pre>,
                button: "Update",
                onFinished: (update) => {
                    if(update && PlatformPeg.get()) {
                        PlatformPeg.get().installUpdate();
                    }
                }
            });
        } else {
            const ChangelogDialog = sdk.getComponent('dialogs.ChangelogDialog');
            Modal.createDialog(ChangelogDialog, {
                version: props.version,
                newVersion: props.newVersion,
                releaseNotes: releaseNotes,
                onFinished: (update) => {
                    if(update && PlatformPeg.get()) {
                        PlatformPeg.get().installUpdate();
                    }
                }
            });
        }
    };

    const onUpdateClicked = () => {
        PlatformPeg.get().installUpdate();
    };

    let action_button;
    if (props.releaseNotes || (checkVersion(props.version) && checkVersion(props.newVersion))) {
        action_button = <button className="mx_MatrixToolbar_action" onClick={onChangelogClicked}>What's new?</button>;
    } else if (PlatformPeg.get()) {
        action_button = <button className="mx_MatrixToolbar_action" onClick={onUpdateClicked}>Update</button>;
    }
    return (
        <div className="mx_MatrixToolbar">
            <img className="mx_MatrixToolbar_warning" src="img/warning.svg" width="24" height="23" alt="/!\"/>
            <div className="mx_MatrixToolbar_content">
                A new version of Riot is available.
            </div>
            {action_button}
        </div>
    );
}

NewVersionBar.propTypes = {
    version: React.PropTypes.string.isRequired,
    newVersion: React.PropTypes.string.isRequired,
    releaseNotes: React.PropTypes.string,
};
