/*
Copyright 2024 New Vector Ltd.
Copyright 2016-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode } from "react";
import {
    type IAnnotatedPushRule,
    type IPusher,
    type PushRuleAction,
    PushRuleKind,
    RuleId,
    type IThreepid,
    ThreepidMedium,
    type LocalNotificationSettings,
    type EmptyObject,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import Spinner from "../elements/Spinner";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import {
    ContentRules,
    type IContentRules,
    PushRuleVectorState,
    VectorPushRulesDefinitions,
    VectorState,
    type VectorPushRuleDefinition,
} from "../../../notifications";
import { _t, type TranslatedString } from "../../../languageHandler";
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
import { arrayDiff, filterBoolean } from "../../../utils/arrays";
import { clearAllNotifications, getLocalNotificationAccountDataEventType } from "../../../utils/notifications";
import {
    updateExistingPushRulesWithActions,
    updatePushRuleActions,
} from "../../../utils/pushRules/updatePushRuleActions";
import { Caption } from "../typography/Caption";
import { SettingsSubsectionHeading } from "./shared/SettingsSubsectionHeading";
import { SettingsSubsection } from "./shared/SettingsSubsection";
import { doesRoomHaveUnreadMessages } from "../../../Unread";
import SettingsFlag from "../elements/SettingsFlag";

// TODO: this "view" component still has far too much application logic in it,
// which should be factored out to other files.

enum Phase {
    Loading = "loading",
    Ready = "ready",
    Persisting = "persisting", // technically a meta-state for Ready, but whatever
    // unrecoverable error - eg can't load push rules
    Error = "error",
    // error saving individual rule
    SavingError = "savingError",
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
    // loudest vectorState of a rule and its synced rules
    // undefined when rule has no synced rules
    syncedVectorState?: VectorState;
}

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

    deviceNotificationsEnabled: boolean;
    desktopNotifications: boolean;
    desktopShowBody: boolean;
    audioNotifications: boolean;

    clearingNotifications: boolean;

    ruleIdsWithError: Record<RuleId | string, boolean>;
}
const findInDefaultRules = (
    ruleId: RuleId | string,
    defaultRules: {
        [k in RuleClass]: IAnnotatedPushRule[];
    },
): IAnnotatedPushRule | undefined => {
    for (const category in defaultRules) {
        const rule: IAnnotatedPushRule | undefined = defaultRules[category as RuleClass].find(
            (rule) => rule.rule_id === ruleId,
        );
        if (rule) {
            return rule;
        }
    }
};

// Vector notification states ordered by loudness in ascending order
const OrderedVectorStates = [VectorState.Off, VectorState.On, VectorState.Loud];

/**
 * Find the 'loudest' vector state assigned to a rule
 * and it's synced rules
 * If rules have fallen out of sync,
 * the loudest rule can determine the display value
 * @param defaultRules
 * @param rule - parent rule
 * @param definition - definition of parent rule
 * @returns VectorState - the maximum/loudest state for the parent and synced rules
 */
const maximumVectorState = (
    defaultRules: {
        [k in RuleClass]: IAnnotatedPushRule[];
    },
    rule: IAnnotatedPushRule,
    definition: VectorPushRuleDefinition,
): VectorState | undefined => {
    if (!definition.syncedRuleIds?.length) {
        return undefined;
    }
    const vectorState = definition.syncedRuleIds.reduce<VectorState>((maxVectorState, ruleId) => {
        // already set to maximum
        if (maxVectorState === VectorState.Loud) {
            return maxVectorState;
        }
        const syncedRule = findInDefaultRules(ruleId, defaultRules);
        if (syncedRule) {
            const syncedRuleVectorState = definition.ruleToVectorState(syncedRule);
            // if syncedRule is 'louder' than current maximum
            // set maximum to louder vectorState
            if (
                syncedRuleVectorState &&
                OrderedVectorStates.indexOf(syncedRuleVectorState) > OrderedVectorStates.indexOf(maxVectorState)
            ) {
                return syncedRuleVectorState;
            }
        }
        return maxVectorState;
    }, definition.ruleToVectorState(rule)!);

    return vectorState;
};

const NotificationActivitySettings = (): JSX.Element => {
    return (
        <div>
            <SettingsFlag name="Notifications.showbold" level={SettingLevel.DEVICE} />
            <SettingsFlag name="Notifications.tac_only_notifications" level={SettingLevel.DEVICE} />
        </div>
    );
};

/**
 * The old, deprecated notifications tab view, only displayed if the user has the labs flag disabled.
 */
export default class Notifications extends React.PureComponent<EmptyObject, IState> {
    private settingWatchers: string[] = [];

    public constructor(props: EmptyObject) {
        super(props);

        this.state = {
            phase: Phase.Loading,
            deviceNotificationsEnabled: SettingsStore.getValue("deviceNotificationsEnabled") ?? true,
            desktopNotifications: SettingsStore.getValue("notificationsEnabled"),
            desktopShowBody: SettingsStore.getValue("notificationBodyEnabled"),
            audioNotifications: SettingsStore.getValue("audioNotificationsEnabled"),
            clearingNotifications: false,
            ruleIdsWithError: {},
        };
    }

    private get isInhibited(): boolean {
        // Caution: The master rule's enabled state is inverted from expectation. When
        // the master rule is *enabled* it means all other rules are *disabled* (or
        // inhibited). Conversely, when the master rule is *disabled* then all other rules
        // are *enabled* (or operate fine).
        return !!this.state.masterPushRule?.enabled;
    }

    public componentDidMount(): void {
        this.settingWatchers = [
            SettingsStore.watchSetting("notificationsEnabled", null, (...[, , , , value]) =>
                this.setState({ desktopNotifications: value as boolean }),
            ),
            SettingsStore.watchSetting("deviceNotificationsEnabled", null, (...[, , , , value]) => {
                this.setState({ deviceNotificationsEnabled: value as boolean });
            }),
            SettingsStore.watchSetting("notificationBodyEnabled", null, (...[, , , , value]) =>
                this.setState({ desktopShowBody: value as boolean }),
            ),
            SettingsStore.watchSetting("audioNotificationsEnabled", null, (...[, , , , value]) =>
                this.setState({ audioNotifications: value as boolean }),
            ),
        ];

        // noinspection JSIgnoredPromiseFromCall
        this.refreshFromServer();
        this.refreshFromAccountData();
    }

    public componentWillUnmount(): void {
        this.settingWatchers.forEach((watcher) => SettingsStore.unwatchSetting(watcher));
    }

    public componentDidUpdate(prevProps: Readonly<EmptyObject>, prevState: Readonly<IState>): void {
        if (this.state.deviceNotificationsEnabled !== prevState.deviceNotificationsEnabled) {
            this.persistLocalNotificationSettings(this.state.deviceNotificationsEnabled);
        }
    }

    private async refreshFromServer(): Promise<void> {
        try {
            const newState = (
                await Promise.all([this.refreshRules(), this.refreshPushers(), this.refreshThreepids()])
            ).reduce((p, c) => Object.assign(c, p), {});

            this.setState<
                keyof Pick<
                    IState,
                    "phase" | "vectorKeywordRuleInfo" | "vectorPushRules" | "pushers" | "threepids" | "masterPushRule"
                >
            >({
                ...newState,
                phase: Phase.Ready,
            });
        } catch (e) {
            logger.error("Error setting up notifications for settings: ", e);
            this.setState({ phase: Phase.Error });
        }
    }

    private async refreshFromAccountData(): Promise<void> {
        const cli = MatrixClientPeg.safeGet();
        const settingsEvent = cli.getAccountData(getLocalNotificationAccountDataEventType(cli.deviceId));
        if (settingsEvent) {
            const notificationsEnabled = !(settingsEvent.getContent() as LocalNotificationSettings).is_silenced;
            await this.updateDeviceNotifications(notificationsEnabled);
        }
    }

    private persistLocalNotificationSettings(enabled: boolean): Promise<EmptyObject> {
        const cli = MatrixClientPeg.safeGet();
        return cli.setAccountData(getLocalNotificationAccountDataEventType(cli.deviceId), {
            is_silenced: !enabled,
        });
    }

    private async refreshRules(): Promise<Partial<IState>> {
        const ruleSets = await MatrixClientPeg.safeGet().getPushRules()!;
        const categories: Record<string, RuleClass> = {
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

            for (const r of ruleSets.global[kind]!) {
                const rule: IAnnotatedPushRule = Object.assign(r, { kind });
                const category = categories[rule.rule_id] ?? RuleClass.Other;

                if (rule.rule_id[0] === ".") {
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
                const definition: VectorPushRuleDefinition = VectorPushRulesDefinitions[rule.rule_id];
                const vectorState = definition.ruleToVectorState(rule)!;
                preparedNewState.vectorPushRules[category]!.push({
                    ruleId: rule.rule_id,
                    rule,
                    vectorState,
                    syncedVectorState: maximumVectorState(defaultRules, rule, definition),
                    description: _t(definition.description),
                });
            }

            // Quickly sort the rules for display purposes
            preparedNewState.vectorPushRules[category]!.sort((a, b) => {
                let idxA = RULE_DISPLAY_ORDER.indexOf(a.ruleId);
                let idxB = RULE_DISPLAY_ORDER.indexOf(b.ruleId);

                // Assume unknown things go at the end
                if (idxA < 0) idxA = RULE_DISPLAY_ORDER.length;
                if (idxB < 0) idxB = RULE_DISPLAY_ORDER.length;

                return idxA - idxB;
            });

            if (category === KEYWORD_RULE_CATEGORY) {
                preparedNewState.vectorPushRules[category]!.push({
                    ruleId: KEYWORD_RULE_ID,
                    description: _t("settings|notifications|messages_containing_keywords"),
                    vectorState: preparedNewState.vectorKeywordRuleInfo.vectorState,
                });
            }
        }

        return preparedNewState;
    }

    private refreshPushers(): Promise<Partial<IState>> {
        return MatrixClientPeg.safeGet().getPushers();
    }

    private refreshThreepids(): Promise<Partial<IState>> {
        return MatrixClientPeg.safeGet().getThreePids();
    }

    private showSaveError(): void {
        Modal.createDialog(ErrorDialog, {
            title: _t("settings|notifications|error_saving"),
            description: _t("settings|notifications|error_saving_detail"),
        });
    }

    private onMasterRuleChanged = async (checked: boolean): Promise<void> => {
        this.setState({ phase: Phase.Persisting });

        const masterRule = this.state.masterPushRule!;
        try {
            await MatrixClientPeg.safeGet().setPushRuleEnabled("global", masterRule.kind, masterRule.rule_id, !checked);
            await this.refreshFromServer();
        } catch (e) {
            this.setState({ phase: Phase.Error });
            logger.error("Error updating master push rule:", e);
            this.showSaveError();
        }
    };

    private setSavingError = (ruleId: RuleId | string): void => {
        this.setState(({ ruleIdsWithError }) => ({
            phase: Phase.SavingError,
            ruleIdsWithError: { ...ruleIdsWithError, [ruleId]: true },
        }));
    };

    private updateDeviceNotifications = async (checked: boolean): Promise<void> => {
        await SettingsStore.setValue("deviceNotificationsEnabled", null, SettingLevel.DEVICE, checked);
    };

    private onEmailNotificationsChanged = async (email: string, checked: boolean): Promise<void> => {
        this.setState({ phase: Phase.Persisting });

        try {
            if (checked) {
                await MatrixClientPeg.safeGet().setPusher({
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
                const pusher = this.state.pushers?.find((p) => p.kind === "email" && p.pushkey === email);
                if (pusher) {
                    await MatrixClientPeg.safeGet().removePusher(pusher.pushkey, pusher.app_id);
                }
            }

            await this.refreshFromServer();
        } catch (e) {
            this.setState({ phase: Phase.Error });
            logger.error("Error updating email pusher:", e);
            this.showSaveError();
        }
    };

    private onDesktopNotificationsChanged = async (checked: boolean): Promise<void> => {
        await SettingsStore.setValue("notificationsEnabled", null, SettingLevel.DEVICE, checked);
    };

    private onDesktopShowBodyChanged = async (checked: boolean): Promise<void> => {
        await SettingsStore.setValue("notificationBodyEnabled", null, SettingLevel.DEVICE, checked);
    };

    private onAudioNotificationsChanged = async (checked: boolean): Promise<void> => {
        await SettingsStore.setValue("audioNotificationsEnabled", null, SettingLevel.DEVICE, checked);
    };

    private onRadioChecked = async (rule: IVectorPushRule, checkedState: VectorState): Promise<void> => {
        this.setState(({ ruleIdsWithError }) => ({
            phase: Phase.Persisting,
            ruleIdsWithError: { ...ruleIdsWithError, [rule.ruleId]: false },
        }));

        try {
            const cli = MatrixClientPeg.safeGet();
            if (rule.ruleId === KEYWORD_RULE_ID) {
                // should not encounter this
                if (!this.state.vectorKeywordRuleInfo) {
                    throw new Error("Notification data is incomplete.");
                }
                // Update all the keywords
                for (const rule of this.state.vectorKeywordRuleInfo.rules) {
                    let enabled: boolean | undefined;
                    let actions: PushRuleAction[] | undefined;
                    if (checkedState === VectorState.On) {
                        if (rule.actions.length !== 1) {
                            // XXX: Magic number
                            actions = PushRuleVectorState.actionsFor(checkedState);
                        }
                        if (this.state.vectorKeywordRuleInfo.vectorState === VectorState.Off) {
                            enabled = true;
                        }
                    } else if (checkedState === VectorState.Loud) {
                        if (rule.actions.length !== 3) {
                            // XXX: Magic number
                            actions = PushRuleVectorState.actionsFor(checkedState);
                        }
                        if (this.state.vectorKeywordRuleInfo.vectorState === VectorState.Off) {
                            enabled = true;
                        }
                    } else {
                        enabled = false;
                    }

                    if (actions) {
                        await cli.setPushRuleActions("global", rule.kind, rule.rule_id, actions);
                    }
                    if (enabled !== undefined) {
                        await cli.setPushRuleEnabled("global", rule.kind, rule.rule_id, enabled);
                    }
                }
            } else {
                const definition: VectorPushRuleDefinition = VectorPushRulesDefinitions[rule.ruleId];
                const actions = definition.vectorStateToActions[checkedState];
                // we should not encounter this
                // satisfies types
                if (!rule.rule) {
                    throw new Error("Cannot update rule: push rule data is incomplete.");
                }
                await updatePushRuleActions(cli, rule.rule.rule_id, rule.rule.kind, actions);
                await updateExistingPushRulesWithActions(cli, definition.syncedRuleIds, actions);
            }

            await this.refreshFromServer();
        } catch (e) {
            this.setSavingError(rule.ruleId);
            logger.error("Error updating push rule:", e);
        }
    };

    private onClearNotificationsClicked = async (): Promise<void> => {
        try {
            this.setState({ clearingNotifications: true });
            const client = MatrixClientPeg.safeGet();
            await clearAllNotifications(client);
        } finally {
            this.setState({ clearingNotifications: false });
        }
    };

    private async setKeywords(
        unsafeKeywords: (string | undefined)[],
        originalRules: IAnnotatedPushRule[],
    ): Promise<void> {
        try {
            // De-duplicate and remove empties
            const keywords = filterBoolean<string>(Array.from(new Set(unsafeKeywords)));
            const oldKeywords = filterBoolean<string>(Array.from(new Set(originalRules.map((r) => r.pattern))));

            // Note: Technically because of the UI interaction (at the time of writing), the diff
            // will only ever be +/-1 so we don't really have to worry about efficiently handling
            // tons of keyword changes.

            const diff = arrayDiff<string>(oldKeywords, keywords);

            for (const word of diff.removed) {
                for (const rule of originalRules.filter((r) => r.pattern === word)) {
                    await MatrixClientPeg.safeGet().deletePushRule("global", rule.kind, rule.rule_id);
                }
            }

            let ruleVectorState = this.state.vectorKeywordRuleInfo!.vectorState;
            if (ruleVectorState === VectorState.Off) {
                // When the current global keywords rule is OFF, we need to look at
                // the flavor of existing rules to apply the same actions
                // when creating the new rule.
                const existingRuleVectorState = originalRules.length
                    ? PushRuleVectorState.contentRuleVectorStateKind(originalRules[0])
                    : undefined;
                // set to same state as existing rule, or default to On
                ruleVectorState = existingRuleVectorState ?? VectorState.On; //default
            }
            const kind = PushRuleKind.ContentSpecific;
            for (const word of diff.added) {
                await MatrixClientPeg.safeGet().addPushRule("global", kind, word, {
                    actions: PushRuleVectorState.actionsFor(ruleVectorState),
                    pattern: word,
                });
                if (ruleVectorState === VectorState.Off) {
                    await MatrixClientPeg.safeGet().setPushRuleEnabled("global", kind, word, false);
                }
            }

            await this.refreshFromServer();
        } catch (e) {
            this.setState({ phase: Phase.Error });
            logger.error("Error updating keyword push rules:", e);
            this.showSaveError();
        }
    }

    private onKeywordAdd = (keyword: string): void => {
        // should not encounter this
        if (!this.state.vectorKeywordRuleInfo) {
            throw new Error("Notification data is incomplete.");
        }
        const originalRules = objectClone(this.state.vectorKeywordRuleInfo.rules);

        // We add the keyword immediately as a sort of local echo effect
        this.setState(
            {
                phase: Phase.Persisting,
                vectorKeywordRuleInfo: {
                    ...this.state.vectorKeywordRuleInfo,
                    rules: [
                        ...this.state.vectorKeywordRuleInfo.rules,

                        // XXX: Horrible assumption that we don't need the remaining fields
                        { pattern: keyword } as IAnnotatedPushRule,
                    ],
                },
            },
            async (): Promise<void> => {
                await this.setKeywords(
                    this.state.vectorKeywordRuleInfo!.rules.map((r) => r.pattern),
                    originalRules,
                );
            },
        );
    };

    private onKeywordRemove = (keyword: string): void => {
        // should not encounter this
        if (!this.state.vectorKeywordRuleInfo) {
            throw new Error("Notification data is incomplete.");
        }
        const originalRules = objectClone(this.state.vectorKeywordRuleInfo.rules);

        // We remove the keyword immediately as a sort of local echo effect
        this.setState(
            {
                phase: Phase.Persisting,
                vectorKeywordRuleInfo: {
                    ...this.state.vectorKeywordRuleInfo,
                    rules: this.state.vectorKeywordRuleInfo.rules.filter((r) => r.pattern !== keyword),
                },
            },
            async (): Promise<void> => {
                await this.setKeywords(
                    this.state.vectorKeywordRuleInfo!.rules.map((r) => r.pattern),
                    originalRules,
                );
            },
        );
    };

    private renderTopSection(): JSX.Element {
        const masterSwitch = (
            <LabelledToggleSwitch
                data-testid="notif-master-switch"
                value={!this.isInhibited}
                label={_t("settings|notifications|enable_notifications_account")}
                caption={_t("settings|notifications|enable_notifications_account_detail")}
                onChange={this.onMasterRuleChanged}
                disabled={this.state.phase === Phase.Persisting}
            />
        );

        // If all the rules are inhibited, don't show anything.
        if (this.isInhibited) {
            return masterSwitch;
        }

        const emailSwitches = (this.state.threepids || [])
            .filter((t) => t.medium === ThreepidMedium.Email)
            .map((e) => (
                <LabelledToggleSwitch
                    data-testid="notif-email-switch"
                    key={e.address}
                    value={!!this.state.pushers?.some((p) => p.kind === "email" && p.pushkey === e.address)}
                    label={_t("settings|notifications|enable_email_notifications", { email: e.address })}
                    onChange={this.onEmailNotificationsChanged.bind(this, e.address)}
                    disabled={this.state.phase === Phase.Persisting}
                />
            ));

        return (
            <SettingsSubsection>
                {masterSwitch}

                <LabelledToggleSwitch
                    data-testid="notif-device-switch"
                    value={this.state.deviceNotificationsEnabled}
                    label={_t("settings|notifications|enable_notifications_device")}
                    onChange={(checked) => this.updateDeviceNotifications(checked)}
                    disabled={this.state.phase === Phase.Persisting}
                />

                {this.state.deviceNotificationsEnabled && (
                    <>
                        <LabelledToggleSwitch
                            data-testid="notif-setting-notificationsEnabled"
                            value={this.state.desktopNotifications}
                            onChange={this.onDesktopNotificationsChanged}
                            label={_t("settings|notifications|enable_desktop_notifications_session")}
                            disabled={this.state.phase === Phase.Persisting}
                        />
                        <LabelledToggleSwitch
                            data-testid="notif-setting-notificationBodyEnabled"
                            value={this.state.desktopShowBody}
                            onChange={this.onDesktopShowBodyChanged}
                            label={_t("settings|notifications|show_message_desktop_notification")}
                            disabled={this.state.phase === Phase.Persisting}
                        />
                        <LabelledToggleSwitch
                            data-testid="notif-setting-audioNotificationsEnabled"
                            value={this.state.audioNotifications}
                            onChange={this.onAudioNotificationsChanged}
                            label={_t("settings|notifications|enable_audible_notifications_session")}
                            disabled={this.state.phase === Phase.Persisting}
                        />
                    </>
                )}

                {emailSwitches}
            </SettingsSubsection>
        );
    }

    private renderCategory(category: RuleClass): ReactNode {
        if (this.isInhibited) {
            return null; // nothing to show for the section
        }

        let keywordComposer: JSX.Element | undefined;
        if (category === RuleClass.VectorMentions) {
            const tags = filterBoolean<string>(this.state.vectorKeywordRuleInfo?.rules.map((r) => r.pattern) || []);
            keywordComposer = (
                <TagComposer
                    tags={tags}
                    onAdd={this.onKeywordAdd}
                    onRemove={this.onKeywordRemove}
                    disabled={this.state.phase === Phase.Persisting}
                    label={_t("notifications|keyword")}
                    placeholder={_t("notifications|keyword_new")}
                />
            );
        }

        const VectorStateToLabel = {
            [VectorState.On]: _t("common|on"),
            [VectorState.Off]: _t("common|off"),
            [VectorState.Loud]: _t("settings|notifications|noisy"),
        };

        const makeRadio = (r: IVectorPushRule, s: VectorState): JSX.Element => (
            <StyledRadioButton
                key={r.ruleId + s}
                name={r.ruleId}
                checked={(r.syncedVectorState ?? r.vectorState) === s}
                onChange={this.onRadioChecked.bind(this, r, s)}
                disabled={this.state.phase === Phase.Persisting}
                aria-label={VectorStateToLabel[s]}
            />
        );

        const fieldsetRows = this.state.vectorPushRules?.[category]?.map((r) => (
            <fieldset
                key={category + r.ruleId}
                data-testid={category + r.ruleId}
                className="mx_UserNotifSettings_gridRowContainer"
            >
                <legend className="mx_UserNotifSettings_gridRowLabel">{r.description}</legend>
                {makeRadio(r, VectorState.Off)}
                {makeRadio(r, VectorState.On)}
                {makeRadio(r, VectorState.Loud)}
                {this.state.ruleIdsWithError[r.ruleId] && (
                    <div className="mx_UserNotifSettings_gridRowError">
                        <Caption isError>{_t("settings|notifications|error_updating")}</Caption>
                    </div>
                )}
            </fieldset>
        ));

        let sectionName: string;
        switch (category) {
            case RuleClass.VectorGlobal:
                sectionName = _t("notifications|class_global");
                break;
            case RuleClass.VectorMentions:
                sectionName = _t("notifications|mentions_keywords");
                break;
            case RuleClass.VectorOther:
                sectionName = _t("notifications|class_other");
                break;
            default:
                throw new Error("Developer error: Unnamed notifications section: " + category);
        }

        return (
            <div>
                <div data-testid={`notif-section-${category}`} className="mx_UserNotifSettings_grid">
                    <SettingsSubsectionHeading heading={sectionName} />
                    <span className="mx_UserNotifSettings_gridColumnLabel">{VectorStateToLabel[VectorState.Off]}</span>
                    <span className="mx_UserNotifSettings_gridColumnLabel">{VectorStateToLabel[VectorState.On]}</span>
                    <span className="mx_UserNotifSettings_gridColumnLabel">{VectorStateToLabel[VectorState.Loud]}</span>
                    {fieldsetRows}
                </div>
                {keywordComposer}
            </div>
        );
    }

    private renderTargets(): ReactNode {
        if (this.isInhibited) return null; // no targets if there's no notifications

        const rows = this.state.pushers?.map((p) => (
            <tr key={p.kind + p.pushkey}>
                <td>{p.app_display_name}</td>
                <td>{p.device_display_name}</td>
            </tr>
        ));

        if (!rows?.length) return null; // no targets to show

        return (
            <div className="mx_UserNotifSettings_floatingSection">
                <div>{_t("settings|notifications|push_targets")}</div>
                <table>
                    <tbody>{rows}</tbody>
                </table>
            </div>
        );
    }

    public render(): React.ReactNode {
        if (this.state.phase === Phase.Loading) {
            // Ends up default centered
            return <Spinner />;
        } else if (this.state.phase === Phase.Error) {
            return <p data-testid="error-message">{_t("settings|notifications|error_loading")}</p>;
        }

        let clearNotifsButton: JSX.Element | undefined;
        if (
            MatrixClientPeg.safeGet()
                .getRooms()
                .some((r) => doesRoomHaveUnreadMessages(r, true))
        ) {
            clearNotifsButton = (
                <AccessibleButton
                    onClick={this.onClearNotificationsClicked}
                    disabled={this.state.clearingNotifications}
                    kind="danger"
                    className="mx_UserNotifSettings_clearNotifsButton"
                    data-testid="clear-notifications"
                >
                    {_t("notifications|mark_all_read")}
                </AccessibleButton>
            );
        }

        return (
            <>
                {this.renderTopSection()}
                {this.renderCategory(RuleClass.VectorGlobal)}
                {this.renderCategory(RuleClass.VectorMentions)}
                {this.renderCategory(RuleClass.VectorOther)}
                {this.renderTargets()}
                <NotificationActivitySettings />
                {clearNotifsButton}
            </>
        );
    }
}
