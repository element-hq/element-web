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

import * as React from 'react';
import * as PropTypes from 'prop-types';
import BaseDialog from './BaseDialog';
import { _t } from '../../../languageHandler';
import DialogButtons from '../elements/DialogButtons';

export enum RebrandDialogKind {
    NAG,
    ONE_TIME,
}

interface IProps {
    onFinished: (bool) => void;
    kind: RebrandDialogKind;
    targetUrl?: string;
}

export default class RebrandDialog extends React.PureComponent<IProps> {
    private onDoneClick = () => {
        this.props.onFinished(true);
    };

    private onGoToElementClick = () => {
        this.props.onFinished(true);
    };

    private onRemindMeLaterClick = () => {
        this.props.onFinished(false);
    };

    private getPrettyTargetUrl() {
        const u = new URL(this.props.targetUrl);
        let ret = u.host;
        if (u.pathname !== '/') ret += u.pathname;
        return ret;
    }

    getBodyText() {
        if (this.props.kind === RebrandDialogKind.NAG) {
            return _t(
                "Use your account to sign in to the latest version of the app at <a />", {},
                {
                    a: sub => <a href={this.props.targetUrl} rel="noopener noreferrer" target="_blank">{this.getPrettyTargetUrl()}</a>,
                },
            );
        } else {
            return _t(
                "You’re already signed in and good to go here, but you can also grab the latest " +
                "versions of the app on all platforms at <a>element.io/get-started</a>.", {},
                {
                    a: sub => <a href="https://element.io/get-started" rel="noopener noreferrer" target="_blank">{sub}</a>,
                },
            );
        }
    }

    getDialogButtons() {
        if (this.props.kind === RebrandDialogKind.NAG) {
            return <DialogButtons primaryButton={_t("Go to Element")}
                primaryButtonClass='primary'
                onPrimaryButtonClick={this.onGoToElementClick}
                hasCancel={true}
                cancelButton={"Remind me later"}
                onCancel={this.onRemindMeLaterClick}
                focus={true}
            />;
        } else {
            return <DialogButtons primaryButton={_t("Done")}
                primaryButtonClass='primary'
                hasCancel={false}
                onPrimaryButtonClick={this.onDoneClick}
                focus={true}
            />;
        }
    }

    render() {
        return <BaseDialog title={_t("We’re excited to announce Riot is now Element!")}
            className='mx_RebrandDialog'
            contentId='mx_Dialog_content'
            onFinished={this.props.onFinished}
            hasCancel={false}
        >
            <div className="mx_RebrandDialog_body">{this.getBodyText()}</div>
            <div className="mx_RebrandDialog_logoContainer">
                <img className="mx_RebrandDialog_logo" src={require("../../../../res/img/riot-logo.svg")} alt="Riot Logo" />
                <span className="mx_RebrandDialog_chevron" />
                <img className="mx_RebrandDialog_logo" src={require("../../../../res/img/element-logo.svg")} alt="Element Logo" />
            </div>
            <div>
                {_t(
                    "Learn more at <a>element.io/previously-riot</a>", {}, {
                        a: sub => <a href="https://element.io/previously-riot" rel="noopener noreferrer" target="_blank">{sub}</a>,
                    }
                )}
            </div>
            {this.getDialogButtons()}
        </BaseDialog>;
    }
}
