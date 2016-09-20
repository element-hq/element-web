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
        const ChangelogDialog = sdk.getComponent('dialogs.ChangelogDialog');

        Modal.createDialog(ChangelogDialog, {
            version: props.version,
            newVersion: props.newVersion,
            onFinished: (update) => {
                if(update) {
                    window.location.reload();
                }
            }
        });
    };

    let changelog_button;
    if (checkVersion(props.version) && checkVersion(props.newVersion)) {
        changelog_button = <button className="mx_MatrixToolbar_action" onClick={onChangelogClicked}>Changelog</button>;
    }
    return (
        <div className="mx_MatrixToolbar">
            <img className="mx_MatrixToolbar_warning" src="img/warning.svg" width="24" height="23" alt="/!\"/>
            <div className="mx_MatrixToolbar_content">
                A new version of Riot is available. Refresh your browser.
            </div>
            {changelog_button}
        </div>
    );
}

NewVersionBar.propTypes = {
    version: React.PropTypes.string.isRequired,
    newVersion: React.PropTypes.string.isRequired,
};
