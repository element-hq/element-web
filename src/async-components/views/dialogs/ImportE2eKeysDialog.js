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

import React, {createRef} from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';

import { MatrixClient } from 'matrix-js-sdk';
import * as MegolmExportEncryption from '../../../utils/MegolmExportEncryption';
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            resolve(e.target.result);
        };
        reader.onerror = reject;

        reader.readAsArrayBuffer(file);
    });
}

const PHASE_EDIT = 1;
const PHASE_IMPORTING = 2;

export default createReactClass({
    displayName: 'ImportE2eKeysDialog',

    propTypes: {
        matrixClient: PropTypes.instanceOf(MatrixClient).isRequired,
        onFinished: PropTypes.func.isRequired,
    },

    getInitialState: function() {
        return {
            enableSubmit: false,
            phase: PHASE_EDIT,
            errStr: null,
        };
    },

    // TODO: [REACT-WARNING] Replace component with real class, use constructor for refs
    UNSAFE_componentWillMount: function() {
        this._unmounted = false;

        this._file = createRef();
        this._passphrase = createRef();
    },

    componentWillUnmount: function() {
        this._unmounted = true;
    },

    _onFormChange: function(ev) {
        const files = this._file.current.files || [];
        this.setState({
            enableSubmit: (this._passphrase.current.value !== "" && files.length > 0),
        });
    },

    _onFormSubmit: function(ev) {
        ev.preventDefault();
        this._startImport(this._file.current.files[0], this._passphrase.current.value);
        return false;
    },

    _startImport: function(file, passphrase) {
        this.setState({
            errStr: null,
            phase: PHASE_IMPORTING,
        });

        return readFileAsArrayBuffer(file).then((arrayBuffer) => {
            return MegolmExportEncryption.decryptMegolmKeyFile(
                arrayBuffer, passphrase,
            );
        }).then((keys) => {
            return this.props.matrixClient.importRoomKeys(JSON.parse(keys));
        }).then(() => {
            // TODO: it would probably be nice to give some feedback about what we've imported here.
            this.props.onFinished(true);
        }).catch((e) => {
            console.error("Error importing e2e keys:", e);
            if (this._unmounted) {
                return;
            }
            const msg = e.friendlyText || _t('Unknown error');
            this.setState({
                errStr: msg,
                phase: PHASE_EDIT,
            });
        });
    },

    _onCancelClick: function(ev) {
        ev.preventDefault();
        this.props.onFinished(false);
        return false;
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');

        const disableForm = (this.state.phase !== PHASE_EDIT);

        return (
            <BaseDialog className='mx_importE2eKeysDialog'
                onFinished={this.props.onFinished}
                title={_t("Import room keys")}
            >
                <form onSubmit={this._onFormSubmit}>
                    <div className="mx_Dialog_content">
                        <p>
                            { _t(
                                'This process allows you to import encryption keys ' +
                                'that you had previously exported from another Matrix ' +
                                'client. You will then be able to decrypt any ' +
                                'messages that the other client could decrypt.',
                            ) }
                        </p>
                        <p>
                            { _t(
                                'The export file will be protected with a passphrase. ' +
                                'You should enter the passphrase here, to decrypt the file.',
                            ) }
                        </p>
                        <div className='error'>
                            { this.state.errStr }
                        </div>
                        <div className='mx_E2eKeysDialog_inputTable'>
                            <div className='mx_E2eKeysDialog_inputRow'>
                               <div className='mx_E2eKeysDialog_inputLabel'>
                                   <label htmlFor='importFile'>
                                       { _t("File to import") }
                                   </label>
                               </div>
                               <div className='mx_E2eKeysDialog_inputCell'>
                                   <input
                                       ref={this._file}
                                       id='importFile'
                                       type='file'
                                       autoFocus={true}
                                       onChange={this._onFormChange}
                                       disabled={disableForm} />
                               </div>
                            </div>
                            <div className='mx_E2eKeysDialog_inputRow'>
                               <div className='mx_E2eKeysDialog_inputLabel'>
                                   <label htmlFor='passphrase'>
                                       { _t("Enter passphrase") }
                                   </label>
                               </div>
                               <div className='mx_E2eKeysDialog_inputCell'>
                                   <input
                                       ref={this._passphrase}
                                       id='passphrase'
                                       size='64'
                                       type='password'
                                       onChange={this._onFormChange}
                                       disabled={disableForm} />
                               </div>
                            </div>
                        </div>
                    </div>
                    <div className='mx_Dialog_buttons'>
                        <input className='mx_Dialog_primary' type='submit' value={_t('Import')}
                            disabled={!this.state.enableSubmit || disableForm}
                        />
                        <button onClick={this._onCancelClick} disabled={disableForm}>
                            { _t("Cancel") }
                        </button>
                    </div>
                </form>
            </BaseDialog>
        );
    },
});
