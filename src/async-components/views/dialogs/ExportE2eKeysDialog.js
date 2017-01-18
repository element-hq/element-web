/*
Copyright 2017 Vector Creations Ltd

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

import * as MegolmExportEncryption from '../../../utils/MegolmExportEncryption';

export default React.createClass({
    displayName: 'ExportE2eKeysDialog',

    getInitialState: function() {
        return {
            collectedPassword: false,
        };
    },

    _onPassphraseFormSubmit: function(ev) {
        ev.preventDefault();
        console.log(this.refs.passphrase1.value);
        return false;
    },

    render: function() {
        let content;
        if (!this.state.collectedPassword) {
            content = (
                <div className="mx_Dialog_content">
                    <p>
                        This process will allow you to export the keys for messages
                        you have received in encrypted rooms to a local file. You
                        will then be able to import the file into another Matrix
                        client in the future, so that client will also be able to
                        decrypt these messages.
                    </p>
                    <p>
                        The exported file will allow anyone who can read it to decrypt
                        any encrypted messages that you can see, so you should be
                        careful to keep it secure. To help with this, you should enter
                        a passphrase below, which will be used to encrypt the exported
                        data. It will only be possible to import the data by using the
                        same passphrase.
                    </p>
                    <form onSubmit={this._onPassphraseFormSubmit}>
                        <div className="mx_TextInputDialog_label">
                            <label htmlFor="passphrase1">Enter passphrase</label>
                        </div>
                        <div>
                            <input ref="passphrase1" id="passphrase1"
                                className="mx_TextInputDialog_input"
                                autoFocus={true} size="64" type="password"/>
                        </div>
                        <div className="mx_Dialog_buttons">
                            <input className="mx_Dialog_primary" type="submit" value="Export" />
                        </div>
                    </form>
                </div>
            );
        }

        return (
            <div className="mx_exportE2eKeysDialog">
                <div className="mx_Dialog_title">
                    Export room keys
                </div>
                {content}
            </div>
        );
    },
});
