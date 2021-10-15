/*
Copyright 2016 - 2021 The Matrix.org Foundation C.I.C.

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

import React from "react";
import Spinner from "../elements/Spinner";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { IAnnotatedPushRule, IPusher, PushRuleAction, PushRuleKind, RuleId } from "matrix-js-sdk/src/@types/PushRules";
import {
    ContentRules,
    IContentRules,
    PushRuleVectorState,
    VectorPushRulesDefinitions,
    VectorState,
} from "../../../notifications";
import { _t, TranslatedString } from "../../../languageHandler";
import { IThreepid, ThreepidMedium } from "matrix-js-sdk/src/@types/threepids";
import LabelledToggleSwitch from "../elements/LabelledToggleSwitch";
import SettingsStore from "../../../settings/SettingsStore";
import StyledRadioButton from "../elements/StyledRadioButton";
import { SettingLevel } from "../../../settings/SettingLevel";
import Modal from "../../../Modal";
import ErrorDialog from "../dialogs/ErrorDialog";
import SdkConfig from "../../../SdkConfig";
import AccessibleButton from "../elements/AccessibleButton";
import TagComposer from "../elements/TagComposer";
import { objectClone } from "../../../utils/objects";
import { arrayDiff } from "../../../utils/arrays";

import { logger } from "matrix-js-sdk/src/logger";

// TODO: this "view" component still has far too much application logic in it,
// which should be factored out to other files.

enum Phase {
    Loading = "loading",
    Ready = "ready",
    Persisting = "persisting", // technically a meta-state for Ready, but whatever
    Error = "error",
}

enum RuleClass {
    Master = "master",

    // The vector sections map approximately to UI sections
    VectorGlobal = "vector_global",
    VectorMentions = "vector_mentions",
    VectorOther = "vector_other",
    Other = "other", // unknown rules, essentially
}

const KEYWORD_RULE_ID = "_keywords"; // used as a placeholder "Rule ID" throughout this component
const KEYWORD_RULE_CATEGORY = RuleClass.VectorMentions;

// This array doesn't care about categories: it's just used for a simple sort
const RULE_DISPLAY_ORDER: string[] = [
    // Global
    RuleId.DM,
    RuleId.EncryptedDM,
    RuleId.Message,
    RuleId.EncryptedMessage,

    // Mentions
    RuleId.ContainsDisplayName,
    RuleId.ContainsUserName,
    RuleId.AtRoomNotification,

    // Other
    RuleId.InviteToSelf,
    RuleId.IncomingCall,
    RuleId.SuppressNotices,
    RuleId.Tombstone,
];

interface IVectorPushRule {
    ruleId: RuleId | typeof KEYWORD_RULE_ID | string;
    rule?: IAnnotatedPushRule;
    description: TranslatedString | string;
    vectorState: VectorState;
}

interface IProps {}

interface IState {
    phase: Phase;

    // Optional stuff is required when `phase === Ready`
    masterPushRule?: IAnnotatedPushRule;
    vectorKeywordRuleInfo?: IContentRules;
    vectorPushRules?: {
        [category in RuleClass]?: IVectorPushRule[];
    };
    pushers?: IPusher[];
    threepids?: IThreepid[];
}

export default class Notifications extends React.PureComponent<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            phase: Phase.Loading,
        };
    }

    private get isInhibited(): boolean {
        // Caution: The master rule's enabled state is inverted from expectation. When
        // the master rule is *enabled* it means all other rules are *disabled* (or
        // inhibited). Conversely, when the master rule is *disabled* then all other rules
        // are *enabled* (or operate fine).
        return this.state.masterPushRule?.enabled;
    }

    public componentDidMount() {
        // noinspection JSIgnoredPromiseFromCall
        this.refreshFromServer();
    }

    private async refreshFromServer() {
        try {
            const newState = (await Promise.all([
                this.refreshRules(),
                this.refreshPushers(),
                this.refreshThreepids(),
            ])).reduce((p, c) => Object.assign(c, p), {});

            this.setState({
                ...newState,
                phase: Phase.Ready,
            });
        } catch (e) {
            logger.error("Error setting up notifications for settings: ", e);
            this.setState({ phase: Phase.Error });
        }
    }

    private async refreshRules(): Promise<Partial<IState>> {
        const ruleSets = await MatrixClientPeg.get().getPushRules();

        const categories = {
            [RuleId.Master]: RuleClass.Master,

            [RuleId.DM]: RuleClass.VectorGlobal,
            [RuleId.EncryptedDM]: RuleClass.VectorGlobal,
            [RuleId.Message]: RuleClass.VectorGlobal,
            [RuleId.EncryptedMessage]: RuleClass.VectorGlobal,

            [RuleId.ContainsDisplayName]: RuleClass.VectorMentions,
            [RuleId.ContainsUserName]: RuleClass.VectorMentions,
            [RuleId.AtRoomNotification]: RuleClass.VectorMentions,

            [RuleId.InviteToSelf]: RuleClass.VectorOther,
            [RuleId.IncomingCall]: RuleClass.VectorOther,
            [RuleId.SuppressNotices]: RuleClass.VectorOther,
            [RuleId.Tombstone]: RuleClass.VectorOther,

            // Everything maps to a generic "other" (unknown rule)
        };

        const defaultRules: {
            [k in RuleClass]: IAnnotatedPushRule[];
        } = {
            [RuleClass.Master]: [],
            [RuleClass.VectorGlobal]: [],
            [RuleClass.VectorMentions]: [],
            [RuleClass.VectorOther]: [],
            [RuleClass.Other]: [],
        };

        for (const k in ruleSets.global) {
            // noinspection JSUnfilteredForInLoop
            const kind = k as PushRuleKind;
            for (const r of ruleSets.global[kind]) {
                const rule: IAnnotatedPushRule = Object.assign(r, { kind });
                const category = categories[rule.rule_id] ?? RuleClass.Other;

                if (rule.rule_id[0] === '.') {
                    defaultRules[category].push(rule);
                }
            }
        }

        const preparedNewState: Partial<IState> = {};
        if (defaultRules.master.length > 0) {
            preparedNewState.masterPushRule = defaultRules.master[0];
        } else {
            // XXX: Can this even happen? How do we safely recover?
            throw new Error("Failed to locate a master push rule");
        }

        // Parse keyword rules
        preparedNewState.vectorKeywordRuleInfo = ContentRules.parseContentRules(ruleSets);

        // Prepare rendering for all of our known rules
        preparedNewState.vectorPushRules = {};
        const vectorCategories = [RuleClass.VectorGlobal, RuleClass.VectorMentions, RuleClass.VectorOther];
        for (const category of vectorCategories) {
            preparedNewState.vectorPushRules[category] = [];
            for (const rule of defaultRules[category]) {
                const definition = VectorPushRulesDefinitions[rule.rule_id];
                const vectorState = definition.ruleToVectorState(rule);
                preparedNewState.vectorPushRules[category].push({
                    ruleId: rule.rule_id,
                    rule, vectorState,
                    description: _t(definition.description),
                });
            }

            // Quickly sort the rules for display purposes
            preparedNewState.vectorPushRules[category].sort((a, b) => {
                let idxA = RULE_DISPLAY_ORDER.indexOf(a.ruleId);
                let idxB = RULE_DISPLAY_ORDER.indexOf(b.ruleId);

                // Assume unknown things go at the end
                if (idxA < 0) idxA = RULE_DISPLAY_ORDER.length;
                if (idxB < 0) idxB = RULE_DISPLAY_ORDER.length;

                return idxA - idxB;
            });

            if (category === KEYWORD_RULE_CATEGORY) {
                preparedNewState.vectorPushRules[category].push({
                    ruleId: KEYWORD_RULE_ID,
                    description: _t("Messages containing keywords"),
                    vectorState: preparedNewState.vectorKeywordRuleInfo.vectorState,
                });
            }
        }

        return preparedNewState;
    }

    private refreshPushers(): Promise<Partial<IState>> {
        return MatrixClientPeg.get().getPushers();
    }

    private refreshThreepids(): Promise<Partial<IState>> {
        return MatrixClientPeg.get().getThreePids();
    }

    private showSaveError() {
        Modal.createTrackedDialog('Error saving notification preferences', '', ErrorDialog, {
            title: _t('Error saving notification preferences'),
            description: _t('An error occurred whilst saving your notification preferences.'),
        });
    }

    private onMasterRuleChanged = async (checked: boolean) => {
        this.setState({ phase: Phase.Persisting });

        try {
            const masterRule = this.state.masterPushRule;
            await MatrixClientPeg.get().setPushRuleEnabled('global', masterRule.kind, masterRule.rule_id, !checked);
            await this.refreshFromServer();
        } catch (e) {
            this.setState({ phase: Phase.Error });
            logger.error("Error updating master push rule:", e);
            this.showSaveError();
        }
    };

    private onEmailNotificationsChanged = async (email: string, checked: boolean) => {
        this.setState({ phase: Phase.Persisting });

        try {
            if (checked) {
                await MatrixClientPeg.get().setPusher({
                    kind: "email",
                    app_id: "m.email",
                    pushkey: email,
                    app_display_name: "Email Notifications",
                    device_display_name: email,
                    lang: navigator.language,
                    data: {
                        brand: SdkConfig.get().brand,
                    },

                    // We always append for email pushers since we don't want to stop other
                    // accounts notifying to the same email address
                    append: true,
                });
            } else {
                const pusher = this.state.pushers.find(p => p.kind === "email" && p.pushkey === email);
                pusher.kind = null; // flag for delete
                await MatrixClientPeg.get().setPusher(pusher);
            }

            await this.refreshFromServer();
        } catch (e) {
            this.setState({ phase: Phase.Error });
            logger.error("Error updating email pusher:", e);
            this.showSaveError();
        }
    };

    private onDesktopNotificationsChanged = async (checked: boolean) => {
        await SettingsStore.setValue("notificationsEnabled", null, SettingLevel.DEVICE, checked);
        this.forceUpdate(); // the toggle is controlled by SettingsStore#getValue()
    };

    private onDesktopShowBodyChanged = async (checked: boolean) => {
        await SettingsStore.setValue("notificationBodyEnabled", null, SettingLevel.DEVICE, checked);
        this.forceUpdate(); // the toggle is controlled by SettingsStore#getValue()
    };

    private onAudioNotificationsChanged = async (checked: boolean) => {
        await SettingsStore.setValue("audioNotificationsEnabled", null, SettingLevel.DEVICE, checked);
        this.forceUpdate(); // the toggle is controlled by SettingsStore#getValue()
    };

    private onRadioChecked = async (rule: IVectorPushRule, checkedState: VectorState) => {
        this.setState({ phase: Phase.Persisting });

        try {
            const cli = MatrixClientPeg.get();
            if (rule.ruleId === KEYWORD_RULE_ID) {
                // Update all the keywords
                for (const rule of this.state.vectorKeywordRuleInfo.rules) {
                    let enabled: boolean;
                    let actions: PushRuleAction[];
                    if (checkedState === VectorState.On) {
                        if (rule.actions.length !== 1) { // XXX: Magic number
                            actions = PushRuleVectorState.actionsFor(checkedState);
                        }
                        if (this.state.vectorKeywordRuleInfo.vectorState === VectorState.Off) {
                            enabled = true;
                        }
                    } else if (checkedState === VectorState.Loud) {
                        if (rule.actions.length !== 3) { // XXX: Magic number
                            actions = PushRuleVectorState.actionsFor(checkedState);
                        }
                        if (this.state.vectorKeywordRuleInfo.vectorState === VectorState.Off) {
                            enabled = true;
                        }
                    } else {
                        enabled = false;
                    }

                    if (actions) {
                        await cli.setPushRuleActions('global', rule.kind, rule.rule_id, actions);
                    }
                    if (enabled !== undefined) {
                        await cli.setPushRuleEnabled('global', rule.kind, rule.rule_id, enabled);
                    }
                }
            } else {
                const definition = VectorPushRulesDefinitions[rule.ruleId];
                const actions = definition.vectorStateToActions[checkedState];
                if (!actions) {
                    await cli.setPushRuleEnabled('global', rule.rule.kind, rule.rule.rule_id, false);
                } else {
                    await cli.setPushRuleActions('global', rule.rule.kind, rule.rule.rule_id, actions);
                    await cli.setPushRuleEnabled('global', rule.rule.kind, rule.rule.rule_id, true);
                }
            }

            await this.refreshFromServer();
        } catch (e) {
            this.setState({ phase: Phase.Error });
            logger.error("Error updating push rule:", e);
            this.showSaveError();
        }
    };

    private onClearNotificationsClicked = () => {
        MatrixClientPeg.get().getRooms().forEach(r => {
            if (r.getUnreadNotificationCount() > 0) {
                const events = r.getLiveTimeline().getEvents();
                if (events.length) {
                    // noinspection JSIgnoredPromiseFromCall
                    MatrixClientPeg.get().sendReadReceipt(events[events.length - 1]);
                }
            }
        });
    };

    private async setKeywords(keywords: string[], originalRules: IAnnotatedPushRule[]) {
        try {
            // De-duplicate and remove empties
            keywords = Array.from(new Set(keywords)).filter(k => !!k);
            const oldKeywords = Array.from(new Set(originalRules.map(r => r.pattern))).filter(k => !!k);

            // Note: Technically because of the UI interaction (at the time of writing), the diff
            // will only ever be +/-1 so we don't really have to worry about efficiently handling
            // tons of keyword changes.

            const diff = arrayDiff(oldKeywords, keywords);

            for (const word of diff.removed) {
                for (const rule of originalRules.filter(r => r.pattern === word)) {
                    await MatrixClientPeg.get().deletePushRule('global', rule.kind, rule.rule_id);
                }
            }

            let ruleVectorState = this.state.vectorKeywordRuleInfo.vectorState;
            if (ruleVectorState === VectorState.Off) {
                // When the current global keywords rule is OFF, we need to look at
                // the flavor of existing rules to apply the same actions
                // when creating the new rule.
                if (originalRules.length) {
                    ruleVectorState = PushRuleVectorState.contentRuleVectorStateKind(originalRules[0]);
                } else {
                    ruleVectorState = VectorState.On; // default
                }
            }
            const kind = PushRuleKind.ContentSpecific;
            for (const word of diff.added) {
                await MatrixClientPeg.get().addPushRule('global', kind, word, {
                    actions: PushRuleVectorState.actionsFor(ruleVectorState),
                    pattern: word,
                });
                if (ruleVectorState === VectorState.Off) {
                    await MatrixClientPeg.get().setPushRuleEnabled('global', kind, word, false);
                }
            }

            await this.refreshFromServer();
        } catch (e) {
            this.setState({ phase: Phase.Error });
            logger.error("Error updating keyword push rules:", e);
            this.showSaveError();
        }
    }

    private onKeywordAdd = (keyword: string) => {
        const originalRules = objectClone(this.state.vectorKeywordRuleInfo.rules);

        // We add the keyword immediately as a sort of local echo effect
        this.setState({
            phase: Phase.Persisting,
            vectorKeywordRuleInfo: {
                ...this.state.vectorKeywordRuleInfo,
                rules: [
                    ...this.state.vectorKeywordRuleInfo.rules,

                    // XXX: Horrible assumption that we don't need the remaining fields
                    { pattern: keyword } as IAnnotatedPushRule,
                ],
            },
        }, async () => {
            await this.setKeywords(this.state.vectorKeywordRuleInfo.rules.map(r => r.pattern), originalRules);
        });
    };

    private onKeywordRemove = (keyword: string) => {
        const originalRules = objectClone(this.state.vectorKeywordRuleInfo.rules);

        // We remove the keyword immediately as a sort of local echo effect
        this.setState({
            phase: Phase.Persisting,
            vectorKeywordRuleInfo: {
                ...this.state.vectorKeywordRuleInfo,
                rules: this.state.vectorKeywordRuleInfo.rules.filter(r => r.pattern !== keyword),
            },
        }, async () => {
            await this.setKeywords(this.state.vectorKeywordRuleInfo.rules.map(r => r.pattern), originalRules);
        });
    };

    private renderTopSection() {
        const masterSwitch = <LabelledToggleSwitch
            value={!this.isInhibited}
            label={_t("Enable for this account")}
            onChange={this.onMasterRuleChanged}
            disabled={this.state.phase === Phase.Persisting}
        />;

        // If all the rules are inhibited, don't show anything.
        if (this.isInhibited) {
            return masterSwitch;
        }

        const emailSwitches = (this.state.threepids || []).filter(t => t.medium === ThreepidMedium.Email)
            .map(e => <LabelledToggleSwitch
                key={e.address}
                value={this.state.pushers.some(p => p.kind === "email" && p.pushkey === e.address)}
                label={_t("Enable email notifications for %(email)s", { email: e.address })}
                onChange={this.onEmailNotificationsChanged.bind(this, e.address)}
                disabled={this.state.phase === Phase.Persisting}
            />);

        return <>
            { masterSwitch }

            <LabelledToggleSwitch
                value={SettingsStore.getValue("notificationsEnabled")}
                onChange={this.onDesktopNotificationsChanged}
                label={_t('Enable desktop notifications for this session')}
                disabled={this.state.phase === Phase.Persisting}
            />

            <LabelledToggleSwitch
                value={SettingsStore.getValue("notificationBodyEnabled")}
                onChange={this.onDesktopShowBodyChanged}
                label={_t('Show message in desktop notification')}
                disabled={this.state.phase === Phase.Persisting}
            />

            <LabelledToggleSwitch
                value={SettingsStore.getValue("audioNotificationsEnabled")}
                onChange={this.onAudioNotificationsChanged}
                label={_t('Enable audible notifications for this session')}
                disabled={this.state.phase === Phase.Persisting}
            />

            { emailSwitches }
        </>;
    }

    private renderCategory(category: RuleClass) {
        if (category !== RuleClass.VectorOther && this.isInhibited) {
            return null; // nothing to show for the section
        }

        let clearNotifsButton: JSX.Element;
        if (
            category === RuleClass.VectorOther
            && MatrixClientPeg.get().getRooms().some(r => r.getUnreadNotificationCount() > 0)
        ) {
            clearNotifsButton = <AccessibleButton
                onClick={this.onClearNotificationsClicked}
                kind='danger'
                className='mx_UserNotifSettings_clearNotifsButton'
            >{ _t("Clear notifications") }</AccessibleButton>;
        }

        if (category === RuleClass.VectorOther && this.isInhibited) {
            // only render the utility buttons (if needed)
            if (clearNotifsButton) {
                return <div className='mx_UserNotifSettings_floatingSection'>
                    <div>{ _t("Other") }</div>
                    { clearNotifsButton }
                </div>;
            }
            return null;
        }

        let keywordComposer: JSX.Element;
        if (category === RuleClass.VectorMentions) {
            keywordComposer = <TagComposer
                tags={this.state.vectorKeywordRuleInfo?.rules.map(r => r.pattern)}
                onAdd={this.onKeywordAdd}
                onRemove={this.onKeywordRemove}
                disabled={this.state.phase === Phase.Persisting}
                label={_t("Keyword")}
                placeholder={_t("New keyword")}
            />;
        }

        const makeRadio = (r: IVectorPushRule, s: VectorState) => (
            <StyledRadioButton
                key={r.ruleId}
                name={r.ruleId}
                checked={r.vectorState === s}
                onChange={this.onRadioChecked.bind(this, r, s)}
                disabled={this.state.phase === Phase.Persisting}
            />
        );

        const rows = this.state.vectorPushRules[category].map(r => <tr key={category + r.ruleId}>
            <td>{ r.description }</td>
            <td>{ makeRadio(r, VectorState.Off) }</td>
            <td>{ makeRadio(r, VectorState.On) }</td>
            <td>{ makeRadio(r, VectorState.Loud) }</td>
        </tr>);

        let sectionName: TranslatedString;
        switch (category) {
            case RuleClass.VectorGlobal:
                sectionName = _t("Global");
                break;
            case RuleClass.VectorMentions:
                sectionName = _t("Mentions & keywords");
                break;
            case RuleClass.VectorOther:
                sectionName = _t("Other");
                break;
            default:
                throw new Error("Developer error: Unnamed notifications section: " + category);
        }

        return <>
            <table className='mx_UserNotifSettings_pushRulesTable'>
                <thead>
                    <tr>
                        <th>{ sectionName }</th>
                        <th>{ _t("Off") }</th>
                        <th>{ _t("On") }</th>
                        <th>{ _t("Noisy") }</th>
                    </tr>
                </thead>
                <tbody>
                    { rows }
                </tbody>
            </table>
            { clearNotifsButton }
            { keywordComposer }
        </>;
    }

    private renderTargets() {
        if (this.isInhibited) return null; // no targets if there's no notifications

        const rows = this.state.pushers.map(p => <tr key={p.kind+p.pushkey}>
            <td>{ p.app_display_name }</td>
            <td>{ p.device_display_name }</td>
        </tr>);

        if (!rows.length) return null; // no targets to show

        return <div className='mx_UserNotifSettings_floatingSection'>
            <div>{ _t("Notification targets") }</div>
            <table>
                <tbody>
                    { rows }
                </tbody>
            </table>
        </div>;
    }

    public render() {
        if (this.state.phase === Phase.Loading) {
            // Ends up default centered
            return <Spinner />;
        } else if (this.state.phase === Phase.Error) {
            return <p>{ _t("There was an error loading your notification settings.") }</p>;
        }

        return <div className='mx_UserNotifSettings'>
            { this.renderTopSection() }
            { this.renderCategory(RuleClass.VectorGlobal) }
            { this.renderCategory(RuleClass.VectorMentions) }
            { this.renderCategory(RuleClass.VectorOther) }
            { this.renderTargets() }
        </div>;
    }
}
