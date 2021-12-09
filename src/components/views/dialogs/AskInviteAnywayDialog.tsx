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

import { _t } from '../../../languageHandler';
import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import BaseDialog from "./BaseDialog";

interface IProps {
    unknownProfileUsers: Array<{
        userId: string;
        errorText: string;
    }>;
    onInviteAnyways: () => void;
    onGiveUp: () => void;
    onFinished: (success: boolean) => void;
}

@replaceableComponent("views.dialogs.AskInviteAnywayDialog")
export default class AskInviteAnywayDialog extends React.Component<IProps> {
    private onInviteClicked = (): void => {
        this.props.onInviteAnyways();
        this.props.onFinished(true);
    };

    private onInviteNeverWarnClicked = (): void => {
        SettingsStore.setValue("promptBeforeInviteUnknownUsers", null, SettingLevel.ACCOUNT, false);
        this.props.onInviteAnyways();
        this.props.onFinished(true);
    };

    private onGiveUpClicked = (): void => {
        this.props.onGiveUp();
        this.props.onFinished(false);
    };

    public render() {
        const errorList = this.props.unknownProfileUsers
            .map(address => <li key={address.userId}>{ address.userId }: { address.errorText }</li>);

        return (
            <BaseDialog className='mx_RetryInvitesDialog'
                onFinished={this.onGiveUpClicked}
                title={_t('The following users may not exist')}
                contentId='mx_Dialog_content'
            >
                <div id='mx_Dialog_content'>
                    <p>{ _t("Unable to find profiles for the Matrix IDs listed below - " +
                        "would you like to invite them anyway?") }</p>
                    <ul>
                        { errorList }
                    </ul>
                </div>

                <div className="mx_Dialog_buttons">
                    <button onClick={this.onGiveUpClicked}>
                        { _t('Close') }
                    </button>
                    <button onClick={this.onInviteNeverWarnClicked}>
                        { _t('Invite anyway and never warn me again') }
                    </button>
                    <button onClick={this.onInviteClicked} autoFocus={true}>
                        { _t('Invite anyway') }
                    </button>
                </div>
            </BaseDialog>
        );
    }
}
