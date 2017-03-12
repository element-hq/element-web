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
var React = require('react');
var ReactDOM = require('react-dom');
var sdk = require('../../index');
var MatrixClientPeg = require("../../MatrixClientPeg");
var PlatformPeg = require("../../PlatformPeg");
var Modal = require('../../Modal');
var dis = require("../../dispatcher");
var q = require('q');
var package_json = require('../../../package.json');
var UserSettingsStore = require('../../UserSettingsStore');
var GeminiScrollbar = require('react-gemini-scrollbar');
var Email = require('../../email');
var AddThreepid = require('../../AddThreepid');
var SdkConfig = require('../../SdkConfig');
import AccessibleButton from '../views/elements/AccessibleButton';

// if this looks like a release, use the 'version' from package.json; else use
// the git sha.
const REACT_SDK_VERSION =
      'dist' in package_json ? package_json.version : package_json.gitHead || "<local>";


// Enumerate some simple 'flip a bit' UI settings (if any).
// 'id' gives the key name in the im.vector.web.settings account data event
// 'label' is how we describe it in the UI.
const SETTINGS_LABELS = [
    {
        id: 'autoplayGifsAndVideos',
        label: 'Autoplay GIFs and videos',
    },
/*
    {
        id: 'alwaysShowTimestamps',
        label: 'Always show message timestamps',
    },
    {
        id: 'showTwelveHourTimestamps',
        label: 'Show timestamps in 12 hour format (e.g. 2:30pm)',
    },
    {
        id: 'useCompactLayout',
        label: 'Use compact timeline layout',
    },
    {
        id: 'useFixedWidthFont',
        label: 'Use fixed width font',
    },
*/
];

const CRYPTO_SETTINGS_LABELS = [
    {
        id: 'blacklistUnverifiedDevices',
        label: 'Never send encrypted messages to unverified devices from this device',
    },
    // XXX: this is here for documentation; the actual setting is managed via RoomSettings
    // {
    //     id: 'blacklistUnverifiedDevicesPerRoom'
    //     label: 'Never send encrypted messages to unverified devices in this room',
    // }
];

// Enumerate the available themes, with a nice human text label.
// 'id' gives the key name in the im.vector.web.settings account data event
// 'value' is the value for that key in the event
// 'label' is how we describe it in the UI.
//
// XXX: Ideally we would have a theme manifest or something and they'd be nicely
// packaged up in a single directory, and/or located at the application layer.
// But for now for expedience we just hardcode them here.
const THEMES = [
    {
        id: 'theme',
        label: 'Light theme',
        value: 'light',
    },
    {
        id: 'theme',
        label: 'Dark theme',
        value: 'dark',
    }
];


module.exports = React.createClass({
    displayName: 'UserSettings',

    propTypes: {
        onClose: React.PropTypes.func,
        // The brand string given when creating email pushers
        brand: React.PropTypes.string,

        // True to show the 'labs' section of experimental features
        enableLabs: React.PropTypes.bool,

        // The base URL to use in the referral link. Defaults to window.location.origin.
        referralBaseUrl: React.PropTypes.string,

        // true if RightPanel is collapsed
        collapsedRhs: React.PropTypes.bool,

        // Team token for the referral link. If falsy, the referral section will
        // not appear
        teamToken: React.PropTypes.string,
    },

    getDefaultProps: function() {
        return {
            onClose: function() {},
            enableLabs: true,
        };
    },

    getInitialState: function() {
        return {
            avatarUrl: null,
            threePids: [],
            phase: "UserSettings.LOADING", // LOADING, DISPLAY
            email_add_pending: false,
            vectorVersion: null,
            rejectingInvites: false,
        };
    },

    componentWillMount: function() {
        this._unmounted = false;

        if (PlatformPeg.get()) {
            q().then(() => {
                return PlatformPeg.get().getAppVersion();
            }).done((appVersion) => {
                if (this._unmounted) return;
                this.setState({
                    vectorVersion: appVersion,
                });
            }, (e) => {
                console.log("Failed to fetch app version", e);
            });
        }

        // Bulk rejecting invites:
        // /sync won't have had time to return when UserSettings re-renders from state changes, so getRooms()
        // will still return rooms with invites. To get around this, add a listener for
        // membership updates and kick the UI.
        MatrixClientPeg.get().on("RoomMember.membership", this._onInviteStateChange);

        dis.dispatch({
            action: 'ui_opacity',
            sideOpacity: 0.3,
            middleOpacity: 0.3,
        });
        this._refreshFromServer();

        var syncedSettings = UserSettingsStore.getSyncedSettings();
        if (!syncedSettings.theme) {
            syncedSettings.theme = 'light';
        }
        this._syncedSettings = syncedSettings;

        this._localSettings = UserSettingsStore.getLocalSettings();
    },

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
        this._me = MatrixClientPeg.get().credentials.userId;
    },

    componentWillUnmount: function() {
        this._unmounted = true;
        dis.dispatch({
            action: 'ui_opacity',
            sideOpacity: 1.0,
            middleOpacity: 1.0,
        });
        dis.unregister(this.dispatcherRef);
        let cli = MatrixClientPeg.get();
        if (cli) {
            cli.removeListener("RoomMember.membership", this._onInviteStateChange);
        }
    },

    _refreshFromServer: function() {
        var self = this;
        q.all([
            UserSettingsStore.loadProfileInfo(), UserSettingsStore.loadThreePids()
        ]).done(function(resps) {
            self.setState({
                avatarUrl: resps[0].avatar_url,
                threepids: resps[1].threepids,
                phase: "UserSettings.DISPLAY",
            });
        }, function(error) {
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            console.error("Failed to load user settings: " + error);
            Modal.createDialog(ErrorDialog, {
                title: "Can't load user settings",
                description: "Server may be unavailable or overloaded",
            });
        });
    },

    onAction: function(payload) {
        if (payload.action === "notifier_enabled") {
            this.forceUpdate();
        }
    },

    onAvatarPickerClick: function(ev) {
        if (MatrixClientPeg.get().isGuest()) {
            var NeedToRegisterDialog = sdk.getComponent("dialogs.NeedToRegisterDialog");
            Modal.createDialog(NeedToRegisterDialog, {
                title: "Please Register",
                description: "Guests can't set avatars. Please register.",
            });
            return;
        }

        if (this.refs.file_label) {
            this.refs.file_label.click();
        }
    },

    onAvatarSelected: function(ev) {
        var self = this;
        var changeAvatar = this.refs.changeAvatar;
        if (!changeAvatar) {
            console.error("No ChangeAvatar found to upload image to!");
            return;
        }
        changeAvatar.onFileSelected(ev).done(function() {
            // dunno if the avatar changed, re-check it.
            self._refreshFromServer();
        }, function(err) {
            var errMsg = (typeof err === "string") ? err : (err.error || "");
            console.error("Failed to set avatar: " + err);
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: "Error",
                description: "Failed to set avatar."
            });
        });
    },

    onLogoutClicked: function(ev) {
        var QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        Modal.createDialog(QuestionDialog, {
            title: "Sign out?",
            description:
                <div>
                    For security, logging out will delete any end-to-end encryption keys from this browser,
                    making previous encrypted chat history unreadable if you log back in.
                    In future this <a href="https://github.com/vector-im/riot-web/issues/2108">will be improved</a>,
                    but for now be warned.
                </div>,
            button: "Sign out",
            onFinished: (confirmed) => {
                if (confirmed) {
                    dis.dispatch({action: 'logout'});
                    if (this.props.onFinished) {
                        this.props.onFinished();
                    }
                }
            },
        });
    },

    onPasswordChangeError: function(err) {
        var errMsg = err.error || "";
        if (err.httpStatus === 403) {
            errMsg = "Failed to change password. Is your password correct?";
        }
        else if (err.httpStatus) {
            errMsg += ` (HTTP status ${err.httpStatus})`;
        }
        var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        console.error("Failed to change password: " + errMsg);
        Modal.createDialog(ErrorDialog, {
            title: "Error",
            description: errMsg
        });
    },

    onPasswordChanged: function() {
        var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        Modal.createDialog(ErrorDialog, {
            title: "Success",
            description: `Your password was successfully changed. You will not
                          receive push notifications on other devices until you
                          log back in to them.`
        });
    },

    onUpgradeClicked: function() {
        dis.dispatch({
            action: "start_upgrade_registration"
        });
    },

    onEnableNotificationsChange: function(event) {
        UserSettingsStore.setEnableNotifications(event.target.checked);
    },

    onAddThreepidClicked: function(value, shouldSubmit) {
        if (!shouldSubmit) return;
        var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        var QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");

        var email_address = this.refs.add_threepid_input.value;
        if (!Email.looksValid(email_address)) {
            Modal.createDialog(ErrorDialog, {
                title: "Invalid Email Address",
                description: "This doesn't appear to be a valid email address",
            });
            return;
        }
        this.add_threepid = new AddThreepid();
        // we always bind emails when registering, so let's do the
        // same here.
        this.add_threepid.addEmailAddress(email_address, true).done(() => {
            Modal.createDialog(QuestionDialog, {
                title: "Verification Pending",
                description: "Please check your email and click on the link it contains. Once this is done, click continue.",
                button: 'Continue',
                onFinished: this.onEmailDialogFinished,
            });
        }, (err) => {
            this.setState({email_add_pending: false});
            console.error("Unable to add email address " + email_address + " " + err);
            Modal.createDialog(ErrorDialog, {
                title: "Error",
                description: "Unable to add email address"
            });
        });
        ReactDOM.findDOMNode(this.refs.add_threepid_input).blur();
        this.setState({email_add_pending: true});
    },

    onRemoveThreepidClicked: function(threepid) {
        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        Modal.createDialog(QuestionDialog, {
            title: "Remove Contact Information?",
            description: "Remove " + threepid.address + "?",
            button: 'Remove',
            onFinished: (submit) => {
                if (submit) {
                    this.setState({
                        phase: "UserSettings.LOADING",
                    });
                    MatrixClientPeg.get().deleteThreePid(threepid.medium, threepid.address).then(() => {
                        return this._refreshFromServer();
                    }).catch((err) => {
                        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                        console.error("Unable to remove contact information: " + err);
                        Modal.createDialog(ErrorDialog, {
                            title: "Error",
                            description: "Unable to remove contact information",
                        });
                    }).done();
                }
            },
        });
    },

    onEmailDialogFinished: function(ok) {
        if (ok) {
            this.verifyEmailAddress();
        } else {
            this.setState({email_add_pending: false});
        }
    },

    verifyEmailAddress: function() {
        this.add_threepid.checkEmailLinkClicked().done(() => {
            this.add_threepid = undefined;
            this.setState({
                phase: "UserSettings.LOADING",
            });
            this._refreshFromServer();
            this.setState({email_add_pending: false});
        }, (err) => {
            this.setState({email_add_pending: false});
            if (err.errcode == 'M_THREEPID_AUTH_FAILED') {
                var QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
                var message = "Unable to verify email address. ";
                message += "Please check your email and click on the link it contains. Once this is done, click continue.";
                Modal.createDialog(QuestionDialog, {
                    title: "Verification Pending",
                    description: message,
                    button: 'Continue',
                    onFinished: this.onEmailDialogFinished,
                });
            } else {
                var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                console.error("Unable to verify email address: " + err);
                Modal.createDialog(ErrorDialog, {
                    title: "Error",
                    description: "Unable to verify email address",
                });
            }
        });
    },

    _onDeactivateAccountClicked: function() {
        const DeactivateAccountDialog = sdk.getComponent("dialogs.DeactivateAccountDialog");
        Modal.createDialog(DeactivateAccountDialog, {});
    },

    _onBugReportClicked: function() {
        const BugReportDialog = sdk.getComponent("dialogs.BugReportDialog");
        if (!BugReportDialog) {
            return;
        }
        Modal.createDialog(BugReportDialog, {});
    },

    _onClearCacheClicked: function() {
        MatrixClientPeg.get().store.deleteAllData().done(() => {
            // forceReload=false since we don't really need new HTML/JS files
            // we just need to restart the JS runtime.
            window.location.reload(false);
        });
    },

    _onInviteStateChange: function(event, member, oldMembership) {
        if (member.userId === this._me && oldMembership === "invite") {
            this.forceUpdate();
        }
    },

    _onRejectAllInvitesClicked: function(rooms, ev) {
        this.setState({
            rejectingInvites: true
        });
        // reject the invites
        let promises = rooms.map((room) => {
            return MatrixClientPeg.get().leave(room.roomId);
        });
        // purposefully drop errors to the floor: we'll just have a non-zero number on the UI
        // after trying to reject all the invites.
        q.allSettled(promises).then(() => {
            this.setState({
                rejectingInvites: false
            });
        }).done();
    },

    _onExportE2eKeysClicked: function() {
        Modal.createDialogAsync(
            (cb) => {
                require.ensure(['../../async-components/views/dialogs/ExportE2eKeysDialog'], () => {
                    cb(require('../../async-components/views/dialogs/ExportE2eKeysDialog'));
                }, "e2e-export");
            }, {
                matrixClient: MatrixClientPeg.get(),
            }
        );
    },

    _onImportE2eKeysClicked: function() {
        Modal.createDialogAsync(
            (cb) => {
                require.ensure(['../../async-components/views/dialogs/ImportE2eKeysDialog'], () => {
                    cb(require('../../async-components/views/dialogs/ImportE2eKeysDialog'));
                }, "e2e-export");
            }, {
                matrixClient: MatrixClientPeg.get(),
            }
        );
    },

    _renderReferral: function() {
        const teamToken = this.props.teamToken;
        if (!teamToken) {
            return null;
        }
        if (typeof teamToken !== 'string') {
            console.warn('Team token not a string');
            return null;
        }
        const href = (this.props.referralBaseUrl || window.location.origin) +
            `/#/register?referrer=${this._me}&team_token=${teamToken}`;
        return (
            <div>
                <h3>Referral</h3>
                <div className="mx_UserSettings_section">
                    Refer a friend to Riot: <a href={href}>{href}</a>
                </div>
            </div>
        );
    },

    _renderUserInterfaceSettings: function() {
        var client = MatrixClientPeg.get();

        return (
            <div>
                <h3>User Interface</h3>
                <div className="mx_UserSettings_section">
                    { this._renderUrlPreviewSelector() }
                    { SETTINGS_LABELS.map( this._renderSyncedSetting ) }
                    { THEMES.map( this._renderThemeSelector ) }
                </div>
            </div>
        );
    },

    _renderUrlPreviewSelector: function() {
        return <div className="mx_UserSettings_toggle">
            <input id="urlPreviewsDisabled"
                   type="checkbox"
                   defaultChecked={ UserSettingsStore.getUrlPreviewsDisabled() }
                   onChange={ e => UserSettingsStore.setUrlPreviewsDisabled(e.target.checked) }
            />
            <label htmlFor="urlPreviewsDisabled">
                Disable inline URL previews by default
            </label>
        </div>;
    },

    _renderSyncedSetting: function(setting) {
        return <div className="mx_UserSettings_toggle" key={ setting.id }>
            <input id={ setting.id }
                   type="checkbox"
                   defaultChecked={ this._syncedSettings[setting.id] }
                   onChange={ e => UserSettingsStore.setSyncedSetting(setting.id, e.target.checked) }
            />
            <label htmlFor={ setting.id }>
                { setting.label }
            </label>
        </div>;
    },

    _renderThemeSelector: function(setting) {
        return <div className="mx_UserSettings_toggle" key={ setting.id + "_" + setting.value }>
            <input id={ setting.id + "_" + setting.value }
                   type="radio"
                   name={ setting.id }
                   value={ setting.value }
                   defaultChecked={ this._syncedSettings[setting.id] === setting.value }
                   onChange={ e => {
                            if (e.target.checked) {
                                UserSettingsStore.setSyncedSetting(setting.id, setting.value);
                            }
                            dis.dispatch({
                                action: 'set_theme',
                                value: setting.value,
                            });
                        }
                   }
            />
            <label htmlFor={ setting.id + "_" + setting.value }>
                { setting.label }
            </label>
        </div>;
    },

    _renderCryptoInfo: function() {
        const client = MatrixClientPeg.get();
        const deviceId = client.deviceId;
        const identityKey = client.getDeviceEd25519Key() || "<not supported>";

        let importExportButtons = null;

        if (client.isCryptoEnabled) {
            importExportButtons = (
                <div className="mx_UserSettings_importExportButtons">
                    <AccessibleButton className="mx_UserSettings_button"
                            onClick={this._onExportE2eKeysClicked}>
                        Export E2E room keys
                    </AccessibleButton>
                    <AccessibleButton className="mx_UserSettings_button"
                            onClick={this._onImportE2eKeysClicked}>
                        Import E2E room keys
                    </AccessibleButton>
                </div>
            );
        }
        return (
            <div>
                <h3>Cryptography</h3>
                <div className="mx_UserSettings_section mx_UserSettings_cryptoSection">
                    <ul>
                        <li><label>Device ID:</label>             <span><code>{deviceId}</code></span></li>
                        <li><label>Device key:</label>            <span><code><b>{identityKey}</b></code></span></li>
                    </ul>
                    { importExportButtons }
                </div>
                <div className="mx_UserSettings_section">
                    { CRYPTO_SETTINGS_LABELS.map( this._renderLocalSetting ) }
                </div>
            </div>
        );
    },

    _renderLocalSetting: function(setting) {
        const client = MatrixClientPeg.get();
        return <div className="mx_UserSettings_toggle" key={ setting.id }>
            <input id={ setting.id }
                   type="checkbox"
                   defaultChecked={ this._localSettings[setting.id] }
                   onChange={
                        e => {
                            UserSettingsStore.setLocalSetting(setting.id, e.target.checked)
                            if (setting.id === 'blacklistUnverifiedDevices') { // XXX: this is a bit ugly
                                client.setGlobalBlacklistUnverifiedDevices(e.target.checked);
                            }
                        }
                    }
            />
            <label htmlFor={ setting.id }>
                { setting.label }
            </label>
        </div>;
    },

    _renderDevicesPanel: function() {
        var DevicesPanel = sdk.getComponent('settings.DevicesPanel');
        return (
            <div>
                <h3>Devices</h3>
                <DevicesPanel className="mx_UserSettings_section"/>
            </div>
        );
    },

    _renderBugReport: function() {
        if (!SdkConfig.get().bug_report_endpoint_url) {
            return <div />
        }
        return (
            <div>
                <h3>Bug Report</h3>
                <div className="mx_UserSettings_section">
                    <p>Found a bug?</p>
                    <button className="mx_UserSettings_button danger"
                        onClick={this._onBugReportClicked}>Report it
                    </button>
                </div>
            </div>
        );
    },

    _renderLabs: function() {
        // default to enabled if undefined
        if (this.props.enableLabs === false) return null;

        let features = UserSettingsStore.LABS_FEATURES.map(feature => (
            <div key={feature.id} className="mx_UserSettings_toggle">
                <input
                    type="checkbox"
                    id={feature.id}
                    name={feature.id}
                    defaultChecked={ UserSettingsStore.isFeatureEnabled(feature.id) }
                    onChange={e => {
                        if (MatrixClientPeg.get().isGuest()) {
                            e.target.checked = false;
                            var NeedToRegisterDialog = sdk.getComponent("dialogs.NeedToRegisterDialog");
                            Modal.createDialog(NeedToRegisterDialog, {
                                title: "Please Register",
                                description: "Guests can't use labs features. Please register.",
                            });
                            return;
                        }

                        UserSettingsStore.setFeatureEnabled(feature.id, e.target.checked);
                        this.forceUpdate();
                    }}/>
                <label htmlFor={feature.id}>{feature.name}</label>
            </div>
        ));
        return (
            <div>
                <h3>Labs</h3>
                <div className="mx_UserSettings_section">
                    <p>These are experimental features that may break in unexpected ways. Use with caution.</p>
                    {features}
                </div>
            </div>
        );
    },

    _renderDeactivateAccount: function() {
        // We can't deactivate a guest account.
        if (MatrixClientPeg.get().isGuest()) return null;

        return <div>
            <h3>Deactivate Account</h3>
                <div className="mx_UserSettings_section">
                    <AccessibleButton className="mx_UserSettings_button danger"
                        onClick={this._onDeactivateAccountClicked}>Deactivate my account
                    </AccessibleButton>
                </div>
        </div>;
    },

    _renderClearCache: function() {
        return <div>
            <h3>Clear Cache</h3>
                <div className="mx_UserSettings_section">
                    <AccessibleButton className="mx_UserSettings_button danger"
                        onClick={this._onClearCacheClicked}>
                        Clear Cache and Reload
                    </AccessibleButton>
                </div>
        </div>;
    },

    _renderBulkOptions: function() {
        let invitedRooms = MatrixClientPeg.get().getRooms().filter((r) => {
            return r.hasMembershipState(this._me, "invite");
        });
        if (invitedRooms.length === 0) {
            return null;
        }

        let Spinner = sdk.getComponent("elements.Spinner");

        let reject = <Spinner />;
        if (!this.state.rejectingInvites) {
            // bind() the invited rooms so any new invites that may come in as this button is clicked
            // don't inadvertently get rejected as well.
            reject = (
                <AccessibleButton className="mx_UserSettings_button danger"
                onClick={this._onRejectAllInvitesClicked.bind(this, invitedRooms)}>
                    Reject all {invitedRooms.length} invites
                </AccessibleButton>
            );
        }

        return <div>
            <h3>Bulk Options</h3>
                <div className="mx_UserSettings_section">
                    {reject}
                </div>
        </div>;
    },

    nameForMedium: function(medium) {
        if (medium == 'msisdn') return 'Phone';
        return medium[0].toUpperCase() + medium.slice(1);
    },

    render: function() {
        var Loader = sdk.getComponent("elements.Spinner");
        switch (this.state.phase) {
            case "UserSettings.LOADING":
                return (
                    <Loader />
                );
            case "UserSettings.DISPLAY":
                break; // quit the switch to return the common state
            default:
                throw new Error("Unknown state.phase => " + this.state.phase);
        }
        // can only get here if phase is UserSettings.DISPLAY
        var SimpleRoomHeader = sdk.getComponent('rooms.SimpleRoomHeader');
        var ChangeDisplayName = sdk.getComponent("views.settings.ChangeDisplayName");
        var ChangePassword = sdk.getComponent("views.settings.ChangePassword");
        var ChangeAvatar = sdk.getComponent('settings.ChangeAvatar');
        var Notifications = sdk.getComponent("settings.Notifications");
        var EditableText = sdk.getComponent('elements.EditableText');

        var avatarUrl = (
            this.state.avatarUrl ? MatrixClientPeg.get().mxcUrlToHttp(this.state.avatarUrl) : null
        );

        var threepidsSection = this.state.threepids.map((val, pidIndex) => {
            const id = "3pid-" + val.address;
            return (
                <div className="mx_UserSettings_profileTableRow" key={pidIndex}>
                    <div className="mx_UserSettings_profileLabelCell">
                        <label htmlFor={id}>{this.nameForMedium(val.medium)}</label>
                    </div>
                    <div className="mx_UserSettings_profileInputCell">
                        <input type="text" key={val.address} id={id} value={val.address} disabled />
                    </div>
                    <div className="mx_UserSettings_threepidButton mx_filterFlipColor">
                        <img src="img/cancel-small.svg" width="14" height="14" alt="Remove" onClick={this.onRemoveThreepidClicked.bind(this, val)} />
                    </div>
                </div>
            );
        });
        var addThreepidSection;
        if (this.state.email_add_pending) {
            addThreepidSection = <Loader />;
        } else if (!MatrixClientPeg.get().isGuest()) {
            addThreepidSection = (
                <div className="mx_UserSettings_profileTableRow" key="new">
                    <div className="mx_UserSettings_profileLabelCell">
                    </div>
                    <div className="mx_UserSettings_profileInputCell">
                        <EditableText
                            ref="add_threepid_input"
                            className="mx_UserSettings_editable"
                            placeholderClassName="mx_UserSettings_threepidPlaceholder"
                            placeholder={ "Add email address" }
                            blurToCancel={ false }
                            onValueChanged={ this.onAddThreepidClicked } />
                    </div>
                    <div className="mx_UserSettings_threepidButton mx_filterFlipColor">
                         <img src="img/plus.svg" width="14" height="14" alt="Add" onClick={ this.onAddThreepidClicked.bind(this, undefined, true) }/>
                    </div>
                </div>
            );
        }
        threepidsSection.push(addThreepidSection);

        var accountJsx;

        if (MatrixClientPeg.get().isGuest()) {
            accountJsx = (
                <div className="mx_UserSettings_button" onClick={this.onUpgradeClicked}>
                    Create an account
                </div>
            );
        }
        else {
            accountJsx = (
                <ChangePassword
                        className="mx_UserSettings_accountTable"
                        rowClassName="mx_UserSettings_profileTableRow"
                        rowLabelClassName="mx_UserSettings_profileLabelCell"
                        rowInputClassName="mx_UserSettings_profileInputCell"
                        buttonClassName="mx_UserSettings_button mx_UserSettings_changePasswordButton"
                        onError={this.onPasswordChangeError}
                        onFinished={this.onPasswordChanged} />
            );
        }
        var notification_area;
        if (!MatrixClientPeg.get().isGuest() && this.state.threepids !== undefined) {
            notification_area = (<div>
                <h3>Notifications</h3>

                <div className="mx_UserSettings_section">
                    <Notifications threepids={this.state.threepids} brand={this.props.brand} />
                </div>
            </div>);
        }

        var olmVersion = MatrixClientPeg.get().olmVersion;
        // If the olmVersion is not defined then either crypto is disabled, or
        // we are using a version old version of olm. We assume the former.
        var olmVersionString = "<not-enabled>";
        if (olmVersion !== undefined) {
            olmVersionString = olmVersion[0] + "." + olmVersion[1] + "." + olmVersion[2];
        }

        return (
            <div className="mx_UserSettings">
                <SimpleRoomHeader
                    title="Settings"
                    collapsedRhs={ this.props.collapsedRhs }
                    onCancelClick={ this.props.onClose }
                />

                <GeminiScrollbar className="mx_UserSettings_body"
                                 autoshow={true}>

                <h3>Profile</h3>

                <div className="mx_UserSettings_section">
                    <div className="mx_UserSettings_profileTable">
                        <div className="mx_UserSettings_profileTableRow">
                            <div className="mx_UserSettings_profileLabelCell">
                                <label htmlFor="displayName">Display name</label>
                            </div>
                            <div className="mx_UserSettings_profileInputCell">
                                <ChangeDisplayName />
                            </div>
                        </div>
                        {threepidsSection}
                    </div>

                    <div className="mx_UserSettings_avatarPicker">
                        <div onClick={ this.onAvatarPickerClick }>
                            <ChangeAvatar ref="changeAvatar" initialAvatarUrl={avatarUrl}
                                showUploadSection={false} className="mx_UserSettings_avatarPicker_img"/>
                        </div>
                        <div className="mx_UserSettings_avatarPicker_edit">
                            <label htmlFor="avatarInput" ref="file_label">
                                <img src="img/camera.svg" className="mx_filterFlipColor"
                                    alt="Upload avatar" title="Upload avatar"
                                    width="17" height="15" />
                            </label>
                            <input id="avatarInput" type="file" onChange={this.onAvatarSelected}/>
                        </div>
                    </div>
                </div>

                <h3>Account</h3>

                <div className="mx_UserSettings_section">

                    <AccessibleButton className="mx_UserSettings_logout mx_UserSettings_button" onClick={this.onLogoutClicked}>
                        Sign out
                    </AccessibleButton>

                    {accountJsx}
                </div>

                {this._renderReferral()}

                {notification_area}

                {this._renderUserInterfaceSettings()}
                {this._renderLabs()}
                {this._renderDevicesPanel()}
                {this._renderCryptoInfo()}
                {this._renderBulkOptions()}
                {this._renderBugReport()}

                <h3>Advanced</h3>

                <div className="mx_UserSettings_section">
                    <div className="mx_UserSettings_advanced">
                        Logged in as {this._me}
                    </div>
                    <div className="mx_UserSettings_advanced">
                        Homeserver is { MatrixClientPeg.get().getHomeserverUrl() }
                    </div>
                    <div className="mx_UserSettings_advanced">
                        Identity Server is { MatrixClientPeg.get().getIdentityServerUrl() }
                    </div>
                    <div className="mx_UserSettings_advanced">
                        matrix-react-sdk version: {REACT_SDK_VERSION}<br/>
                        riot-web version: {this.state.vectorVersion !== null ? this.state.vectorVersion : 'unknown'}<br/>
                        olm version: {olmVersionString}<br/>
                    </div>
                </div>

                {this._renderClearCache()}

                {this._renderDeactivateAccount()}

                </GeminiScrollbar>
            </div>
        );
    }
});
