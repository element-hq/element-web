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

import React, { createRef } from 'react';

import { MatrixClient } from 'matrix-js-sdk/src/client';
import * as MegolmExportEncryption from '../../../../utils/MegolmExportEncryption';
import { _t } from '../../../../languageHandler';
import { IDialogProps } from "../../../../components/views/dialogs/IDialogProps";
import BaseDialog from "../../../../components/views/dialogs/BaseDialog";
import { logger } from "matrix-js-sdk/src/logger";

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            resolve(e.target.result as ArrayBuffer);
        };
        reader.onerror = reject;

        reader.readAsArrayBuffer(file);
    });
}

enum Phase {
    Edit = "edit",
    Importing = "importing",
}

interface IProps extends IDialogProps {
    matrixClient: MatrixClient;
}

interface IState {
    enableSubmit: boolean;
    phase: Phase;
    errStr: string;
}

export default class ImportE2eKeysDialog extends React.Component<IProps, IState> {
    private unmounted = false;
    private file = createRef<HTMLInputElement>();
    private passphrase = createRef<HTMLInputElement>();

    constructor(props: IProps) {
        super(props);

        this.state = {
            enableSubmit: false,
            phase: Phase.Edit,
            errStr: null,
        };
    }

    public componentWillUnmount(): void {
        this.unmounted = true;
    }

    private onFormChange = (ev: React.FormEvent): void => {
        const files = this.file.current.files || [];
        this.setState({
            enableSubmit: (this.passphrase.current.value !== "" && files.length > 0),
        });
    };

    private onFormSubmit = (ev: React.FormEvent): boolean => {
        ev.preventDefault();
        this.startImport(this.file.current.files[0], this.passphrase.current.value);
        return false;
    };

    private startImport(file: File, passphrase: string) {
        this.setState({
            errStr: null,
            phase: Phase.Importing,
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
            logger.error("Error importing e2e keys:", e);
            if (this.unmounted) {
                return;
            }
            const msg = e.friendlyText || _t('Unknown error');
            this.setState({
                errStr: msg,
                phase: Phase.Edit,
            });
        });
    }

    private onCancelClick = (ev: React.MouseEvent): boolean => {
        ev.preventDefault();
        this.props.onFinished(false);
        return false;
    };

    public render(): JSX.Element {
        const disableForm = (this.state.phase !== Phase.Edit);

        return (
            <BaseDialog className='mx_importE2eKeysDialog'
                onFinished={this.props.onFinished}
                title={_t("Import room keys")}
            >
                <form onSubmit={this.onFormSubmit}>
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
                                        ref={this.file}
                                        id='importFile'
                                        type='file'
                                        autoFocus={true}
                                        onChange={this.onFormChange}
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
                                        ref={this.passphrase}
                                        id='passphrase'
                                        size={64}
                                        type='password'
                                        onChange={this.onFormChange}
                                        disabled={disableForm} />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className='mx_Dialog_buttons'>
                        <input
                            className='mx_Dialog_primary'
                            type='submit'
                            value={_t('Import')}
                            disabled={!this.state.enableSubmit || disableForm}
                        />
                        <button onClick={this.onCancelClick} disabled={disableForm}>
                            { _t("Cancel") }
                        </button>
                    </div>
                </form>
            </BaseDialog>
        );
    }
}
