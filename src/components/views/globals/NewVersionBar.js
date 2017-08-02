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

import React from 'react';
import sdk from 'matrix-react-sdk';
import Modal from 'matrix-react-sdk/lib/Modal';
import PlatformPeg from 'matrix-react-sdk/lib/PlatformPeg';
import { _t } from 'matrix-react-sdk/lib/languageHandler';

/**
 * Check a version string is compatible with the Changelog
 * dialog ([vectorversion]-react-[react-sdk-version]-js-[js-sdk-version])
 */
function checkVersion(ver) {
    const parts = ver.split('-');
    return parts.length == 5 && parts[1] == 'react' && parts[3] == 'js';
}

export default React.createClass({
    propTypes: {
        version: React.PropTypes.string.isRequired,
        newVersion: React.PropTypes.string.isRequired,
        releaseNotes: React.PropTypes.string,
    },

    displayReleaseNotes: function(releaseNotes) {
        const QuestionDialog = sdk.getComponent('dialogs.QuestionDialog');
        Modal.createDialog(QuestionDialog, {
            title: _t("What's New"),
            description: <pre className="changelog_text">{releaseNotes}</pre>,
            button: _t("Update"),
            onFinished: (update) => {
                if(update && PlatformPeg.get()) {
                    PlatformPeg.get().installUpdate();
                }
            }
        });
    },

    displayChangelog: function() {
        const ChangelogDialog = sdk.getComponent('dialogs.ChangelogDialog');
        Modal.createDialog(ChangelogDialog, {
            version: this.props.version,
            newVersion: this.props.newVersion,
            onFinished: (update) => {
                if(update && PlatformPeg.get()) {
                    PlatformPeg.get().installUpdate();
                }
            }
        });
    },

    onUpdateClicked: function() {
        PlatformPeg.get().installUpdate();
    },

    render: function() {
        let action_button;
        // If we have release notes to display, we display them. Otherwise,
        // we display the Changelog Dialog which takes two versions and
        // automatically tells you what's changed (provided the versions
        // are in the right format)
        if (this.props.releaseNotes) {
            action_button = (
                <button className="mx_MatrixToolbar_action" onClick={this.displayReleaseNotes}>
                    { _t("What's new?") }
                </button>
            );
        } else if (checkVersion(this.props.version) && checkVersion(this.props.newVersion)) {
            action_button = (
                <button className="mx_MatrixToolbar_action" onClick={this.displayChangelog}>
                    { _t("What's new?") }
                </button>
            );
        } else if (PlatformPeg.get()) {
            action_button = (
                <button className="mx_MatrixToolbar_action" onClick={this.onUpdateClicked}>
                    { _t("Update") }
                </button>
            );
        }
        return (
            <div className="mx_MatrixToolbar">
                <img className="mx_MatrixToolbar_warning" src="img/warning.svg" width="24" height="23" alt="/!\"/>
                <div className="mx_MatrixToolbar_content">
                    {_t("A new version of Riot is available.")}
                </div>
                {action_button}
            </div>
        );
    }
});
