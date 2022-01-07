/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import { Room } from "matrix-js-sdk/src/models/room";
import classNames from 'classnames';
import { logger } from "matrix-js-sdk/src/logger";

import { IntegrationManagers } from "../../../integrations/IntegrationManagers";
import { dialogTermsInteractionCallback, TermsNotSignedError } from "../../../Terms";
import * as ScalarMessaging from "../../../ScalarMessaging";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import { IntegrationManagerInstance } from "../../../integrations/IntegrationManagerInstance";
import ScalarAuthClient from "../../../ScalarAuthClient";
import AccessibleButton from "../elements/AccessibleButton";
import IntegrationManager from "../settings/IntegrationManager";
import { IDialogProps } from "./IDialogProps";

interface IProps extends IDialogProps {
    /**
     * Optional room where the integration manager should be open to
     */
    room?: Room;

    /**
     * Optional screen to open on the integration manager
     */
    screen?: string;

    /**
     * Optional integration ID to open in the integration manager
     */
    integrationId?: string;
}

interface IState {
    managers: IntegrationManagerInstance[];
    busy: boolean;
    currentIndex: number;
    currentConnected: boolean;
    currentLoading: boolean;
    currentScalarClient: ScalarAuthClient;
}

@replaceableComponent("views.dialogs.TabbedIntegrationManagerDialog")
export default class TabbedIntegrationManagerDialog extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {
            managers: IntegrationManagers.sharedInstance().getOrderedManagers(),
            busy: true,
            currentIndex: 0,
            currentConnected: false,
            currentLoading: true,
            currentScalarClient: null,
        };
    }

    public componentDidMount(): void {
        this.openManager(0, true);
    }

    private openManager = async (i: number, force = false): Promise<void> => {
        if (i === this.state.currentIndex && !force) return;

        const manager = this.state.managers[i];
        const client = manager.getScalarClient();
        this.setState({
            busy: true,
            currentIndex: i,
            currentLoading: true,
            currentConnected: false,
            currentScalarClient: client,
        });

        ScalarMessaging.setOpenManagerUrl(manager.uiUrl);

        client.setTermsInteractionCallback((policyInfo, agreedUrls) => {
            // To avoid visual glitching of two modals stacking briefly, we customise the
            // terms dialog sizing when it will appear for the integration manager so that
            // it gets the same basic size as the IM's own modal.
            return dialogTermsInteractionCallback(
                policyInfo, agreedUrls, 'mx_TermsDialog_forIntegrationManager',
            );
        });

        try {
            await client.connect();
            if (!client.hasCredentials()) {
                this.setState({
                    busy: false,
                    currentLoading: false,
                    currentConnected: false,
                });
            } else {
                this.setState({
                    busy: false,
                    currentLoading: false,
                    currentConnected: true,
                });
            }
        } catch (e) {
            if (e instanceof TermsNotSignedError) {
                return;
            }

            logger.error(e);
            this.setState({
                busy: false,
                currentLoading: false,
                currentConnected: false,
            });
        }
    };

    private renderTabs(): JSX.Element[] {
        return this.state.managers.map((m, i) => {
            const classes = classNames({
                'mx_TabbedIntegrationManagerDialog_tab': true,
                'mx_TabbedIntegrationManagerDialog_currentTab': this.state.currentIndex === i,
            });
            return (
                <AccessibleButton
                    className={classes}
                    onClick={() => this.openManager(i)}
                    key={`tab_${i}`}
                    disabled={this.state.busy}
                >
                    { m.name }
                </AccessibleButton>
            );
        });
    }

    public renderTab(): JSX.Element {
        let uiUrl = null;
        if (this.state.currentScalarClient) {
            uiUrl = this.state.currentScalarClient.getScalarInterfaceUrlForRoom(
                this.props.room,
                this.props.screen,
                this.props.integrationId,
            );
        }
        return <IntegrationManager
            loading={this.state.currentLoading}
            connected={this.state.currentConnected}
            url={uiUrl}
            onFinished={() => {/* no-op */}}
        />;
    }

    public render(): JSX.Element {
        return (
            <div className='mx_TabbedIntegrationManagerDialog_container'>
                <div className='mx_TabbedIntegrationManagerDialog_tabs'>
                    { this.renderTabs() }
                </div>
                <div className='mx_TabbedIntegrationManagerDialog_currentManager'>
                    { this.renderTab() }
                </div>
            </div>
        );
    }
}
