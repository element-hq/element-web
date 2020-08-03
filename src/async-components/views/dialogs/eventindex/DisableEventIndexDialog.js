/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
import * as sdk from '../../../../index';
import PropTypes from 'prop-types';
import dis from "../../../../dispatcher/dispatcher";
import { _t } from '../../../../languageHandler';

import SettingsStore from "../../../../settings/SettingsStore";
import EventIndexPeg from "../../../../indexing/EventIndexPeg";
import {Action} from "../../../../dispatcher/actions";
import {SettingLevel} from "../../../../settings/SettingLevel";

/*
 * Allows the user to disable the Event Index.
 */
export default class DisableEventIndexDialog extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
    }

    constructor(props) {
        super(props);

        this.state = {
            disabling: false,
        };
    }

    _onDisable = async () => {
        this.setState({
            disabling: true,
        });

        await SettingsStore.setValue('enableEventIndexing', null, SettingLevel.DEVICE, false);
        await EventIndexPeg.deleteEventIndex();
        this.props.onFinished();
        dis.fire(Action.ViewUserSettings);
    }

    render() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const Spinner = sdk.getComponent('elements.Spinner');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');

        return (
            <BaseDialog onFinished={this.props.onFinished} title={_t("Are you sure?")}>
                {_t("If disabled, messages from encrypted rooms won't appear in search results.")}
                {this.state.disabling ? <Spinner /> : <div />}
                <DialogButtons
                    primaryButton={_t('Disable')}
                    onPrimaryButtonClick={this._onDisable}
                    primaryButtonClass="danger"
                    cancelButtonClass="warning"
                    onCancel={this.props.onFinished}
                    disabled={this.state.disabling}
                />
            </BaseDialog>
        );
    }
}
