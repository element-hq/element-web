/*
Copyright 2017 Michael Telatynski <7t3chguy@gmail.com>
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
import PropTypes from 'prop-types';
import * as sdk from '../../../index';
import SdkConfig from '../../../SdkConfig';
import withValidation from '../elements/Validation';
import { _t } from '../../../languageHandler';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import {Key} from "../../../Keyboard";
import {privateShouldBeEncrypted} from "../../../createRoom";
import {CommunityPrototypeStore} from "../../../stores/CommunityPrototypeStore";

export default class CreateRoomDialog extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
        defaultPublic: PropTypes.bool,
    };

    constructor(props) {
        super(props);

        const config = SdkConfig.get();
        this.state = {
            isPublic: this.props.defaultPublic || false,
            isEncrypted: privateShouldBeEncrypted(),
            name: "",
            topic: "",
            alias: "",
            detailsOpen: false,
            noFederate: config.default_federate === false,
            nameIsValid: false,
        };
    }

    _roomCreateOptions() {
        const opts = {};
        const createOpts = opts.createOpts = {};
        createOpts.name = this.state.name;
        if (this.state.isPublic) {
            createOpts.visibility = "public";
            createOpts.preset = "public_chat";
            opts.guestAccess = false;
            const {alias} = this.state;
            const localPart = alias.substr(1, alias.indexOf(":") - 1);
            createOpts['room_alias_name'] = localPart;
        }
        if (this.state.topic) {
            createOpts.topic = this.state.topic;
        }
        if (this.state.noFederate) {
            createOpts.creation_content = {'m.federate': false};
        }

        if (!this.state.isPublic) {
            opts.encryption = this.state.isEncrypted;
        }

        if (CommunityPrototypeStore.instance.getSelectedCommunityId()) {
            opts.associatedWithCommunity = CommunityPrototypeStore.instance.getSelectedCommunityId();
        }

        return opts;
    }

    componentDidMount() {
        this._detailsRef.addEventListener("toggle", this.onDetailsToggled);
        // move focus to first field when showing dialog
        this._nameFieldRef.focus();
    }

    componentWillUnmount() {
        this._detailsRef.removeEventListener("toggle", this.onDetailsToggled);
    }

    _onKeyDown = event => {
        if (event.key === Key.ENTER) {
            this.onOk();
            event.preventDefault();
            event.stopPropagation();
        }
    };

    onOk = async () => {
        const activeElement = document.activeElement;
        if (activeElement) {
            activeElement.blur();
        }
        await this._nameFieldRef.validate({allowEmpty: false});
        if (this._aliasFieldRef) {
            await this._aliasFieldRef.validate({allowEmpty: false});
        }
        // Validation and state updates are async, so we need to wait for them to complete
        // first. Queue a `setState` callback and wait for it to resolve.
        await new Promise(resolve => this.setState({}, resolve));
        if (this.state.nameIsValid && (!this._aliasFieldRef || this._aliasFieldRef.isValid)) {
            this.props.onFinished(true, this._roomCreateOptions());
        } else {
            let field;
            if (!this.state.nameIsValid) {
                field = this._nameFieldRef;
            } else if (this._aliasFieldRef && !this._aliasFieldRef.isValid) {
                field = this._aliasFieldRef;
            }
            if (field) {
                field.focus();
                field.validate({ allowEmpty: false, focused: true });
            }
        }
    };

    onCancel = () => {
        this.props.onFinished(false);
    };

    onNameChange = ev => {
        this.setState({name: ev.target.value});
    };

    onTopicChange = ev => {
        this.setState({topic: ev.target.value});
    };

    onPublicChange = isPublic => {
        this.setState({isPublic});
    };

    onEncryptedChange = isEncrypted => {
        this.setState({isEncrypted});
    };

    onAliasChange = alias => {
        this.setState({alias});
    };

    onDetailsToggled = ev => {
        this.setState({detailsOpen: ev.target.open});
    };

    onNoFederateChange = noFederate => {
        this.setState({noFederate});
    };

    collectDetailsRef = ref => {
        this._detailsRef = ref;
    };

    onNameValidate = async fieldState => {
        const result = await CreateRoomDialog._validateRoomName(fieldState);
        this.setState({nameIsValid: result.valid});
        return result;
    };

    static _validateRoomName = withValidation({
        rules: [
            {
                key: "required",
                test: async ({ value }) => !!value,
                invalid: () => _t("Please enter a name for the room"),
            },
        ],
    });

    render() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        const Field = sdk.getComponent('views.elements.Field');
        const LabelledToggleSwitch = sdk.getComponent('views.elements.LabelledToggleSwitch');
        const RoomAliasField = sdk.getComponent('views.elements.RoomAliasField');

        let aliasField;
        if (this.state.isPublic) {
            const domain = MatrixClientPeg.get().getDomain();
            aliasField = (
                <div className="mx_CreateRoomDialog_aliasContainer">
                    <RoomAliasField ref={ref => this._aliasFieldRef = ref} onChange={this.onAliasChange} domain={domain} value={this.state.alias} />
                </div>
            );
        }

        let publicPrivateLabel = <p>{_t(
            "Private rooms can be found and joined by invitation only. Public rooms can be " +
            "found and joined by anyone.",
        )}</p>;
        if (CommunityPrototypeStore.instance.getSelectedCommunityId()) {
            publicPrivateLabel = <p>{_t(
                "Private rooms can be found and joined by invitation only. Public rooms can be " +
                "found and joined by anyone in this community.",
            )}</p>;
        }

        let e2eeSection;
        if (!this.state.isPublic) {
            let microcopy;
            if (privateShouldBeEncrypted()) {
                microcopy = _t("You can’t disable this later. Bridges & most bots won’t work yet.");
            } else {
                microcopy = _t("Your server admin has disabled end-to-end encryption by default " +
                    "in private rooms & Direct Messages.");
            }
            e2eeSection = <React.Fragment>
                <LabelledToggleSwitch
                    label={ _t("Enable end-to-end encryption")}
                    onChange={this.onEncryptedChange}
                    value={this.state.isEncrypted}
                    className='mx_CreateRoomDialog_e2eSwitch' // for end-to-end tests
                />
                <p>{ microcopy }</p>
            </React.Fragment>;
        }

        let federateLabel = _t(
            "You might enable this if the room will only be used for collaborating with internal " +
            "teams on your homeserver. This cannot be changed later.",
        );
        if (SdkConfig.get().default_federate === false) {
            // We only change the label if the default setting is different to avoid jarring text changes to the
            // user. They will have read the implications of turning this off/on, so no need to rephrase for them.
            federateLabel = _t(
                "You might disable this if the room will be used for collaborating with external " +
                "teams who have their own homeserver. This cannot be changed later.",
            );
        }

        let title = this.state.isPublic ? _t('Create a public room') : _t('Create a private room');
        if (CommunityPrototypeStore.instance.getSelectedCommunityId()) {
            const name = CommunityPrototypeStore.instance.getSelectedCommunityName();
            title = _t("Create a room in %(communityName)s", {communityName: name});
        }
        return (
            <BaseDialog className="mx_CreateRoomDialog" onFinished={this.props.onFinished}
                title={title}
            >
                <form onSubmit={this.onOk} onKeyDown={this._onKeyDown}>
                    <div className="mx_Dialog_content">
                        <Field ref={ref => this._nameFieldRef = ref} label={ _t('Name') } onChange={this.onNameChange} onValidate={this.onNameValidate} value={this.state.name} className="mx_CreateRoomDialog_name" />
                        <Field label={ _t('Topic (optional)') } onChange={this.onTopicChange} value={this.state.topic} className="mx_CreateRoomDialog_topic" />
                        <LabelledToggleSwitch label={ _t("Make this room public")} onChange={this.onPublicChange} value={this.state.isPublic} />
                        { publicPrivateLabel }
                        { e2eeSection }
                        { aliasField }
                        <details ref={this.collectDetailsRef} className="mx_CreateRoomDialog_details">
                            <summary className="mx_CreateRoomDialog_details_summary">{ this.state.detailsOpen ? _t('Hide advanced') : _t('Show advanced') }</summary>
                            <LabelledToggleSwitch
                                label={_t(
                                    "Block anyone not part of %(serverName)s from ever joining this room.",
                                    {serverName: MatrixClientPeg.getHomeserverName()},
                                )}
                                onChange={this.onNoFederateChange}
                                value={this.state.noFederate}
                            />
                            <p>{federateLabel}</p>
                        </details>
                    </div>
                </form>
                <DialogButtons primaryButton={_t('Create Room')}
                    onPrimaryButtonClick={this.onOk}
                    onCancel={this.onCancel} />
            </BaseDialog>
        );
    }
}
