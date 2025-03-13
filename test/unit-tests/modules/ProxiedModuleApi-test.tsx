/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type TranslationStringsObject } from "@matrix-org/react-sdk-module-api/lib/types/translations";
import { type AccountAuthInfo } from "@matrix-org/react-sdk-module-api/lib/types/AccountAuthInfo";
import { DialogContent, type DialogProps } from "@matrix-org/react-sdk-module-api/lib/components/DialogContent";
import { screen, within } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { type Mocked } from "jest-mock";

import { ProxiedModuleApi } from "../../../src/modules/ProxiedModuleApi";
import { getMockClientWithEventEmitter, mkRoom, stubClient } from "../../test-utils";
import { setLanguage } from "../../../src/languageHandler";
import { ModuleRunner } from "../../../src/modules/ModuleRunner";
import { registerMockModule } from "./MockModule";
import defaultDispatcher from "../../../src/dispatcher/dispatcher";
import { Action } from "../../../src/dispatcher/actions";
import WidgetStore, { type IApp } from "../../../src/stores/WidgetStore";
import { Container, WidgetLayoutStore } from "../../../src/stores/widgets/WidgetLayoutStore";

describe("ProxiedApiModule", () => {
    afterEach(() => {
        ModuleRunner.instance.reset();
    });

    // Note: Remainder is implicitly tested from end-to-end tests of modules.

    describe("translations", () => {
        it("should cache translations", () => {
            const api = new ProxiedModuleApi();
            expect(api.translations).toBeFalsy();

            const translations: TranslationStringsObject = {
                ["custom string"]: {
                    en: "custom string",
                    fr: "custom french string",
                },
            };
            api.registerTranslations(translations);
            expect(api.translations).toBe(translations);
        });

        it("should overwriteAccountAuth", async () => {
            const dispatchSpy = jest.spyOn(defaultDispatcher, "dispatch");

            const api = new ProxiedModuleApi();
            const accountInfo = {} as unknown as AccountAuthInfo;
            const promise = api.overwriteAccountAuth(accountInfo);

            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: Action.OverwriteLogin,
                    credentials: {
                        ...accountInfo,
                        guest: false,
                    },
                }),
                expect.anything(),
            );

            defaultDispatcher.fire(Action.OnLoggedIn);

            await expect(promise).resolves.toBeUndefined();
        });

        describe("integration", () => {
            it("should translate strings using translation system", async () => {
                // Test setup
                stubClient();

                // Set up a module to pull translations through
                const module = registerMockModule();
                const en = "custom string";
                const de = "custom german string";
                const enVars = "custom variable %(var)s";
                const varVal = "string";
                const deVars = "custom german variable %(var)s";
                const deFull = `custom german variable ${varVal}`;
                expect(module.apiInstance).toBeInstanceOf(ProxiedModuleApi);
                module.apiInstance.registerTranslations({
                    [en]: {
                        en: en,
                        de: de,
                    },
                    [enVars]: {
                        en: enVars,
                        de: deVars,
                    },
                });
                await setLanguage("de"); // calls `registerCustomTranslations()` for us

                // See if we can pull the German string out
                expect(module.apiInstance.translateString(en)).toEqual(de);
                expect(module.apiInstance.translateString(enVars, { var: varVal })).toEqual(deFull);
            });

            afterEach(async () => {
                await setLanguage("en"); // reset the language
            });
        });
    });

    describe("openDialog", () => {
        it("should open dialog with a custom title and default options", async () => {
            class MyDialogContent extends DialogContent {
                public constructor(props: DialogProps) {
                    super(props);
                }
                trySubmit = async () => ({ result: true });
                render = () => <p>This is my example content.</p>;
            }

            const api = new ProxiedModuleApi();

            const resultPromise = api.openDialog<{ result: boolean }, DialogProps, MyDialogContent>(
                "My Dialog Title",
                (props, ref) => <MyDialogContent ref={ref} {...props} />,
            );

            const dialog = await screen.findByRole("dialog");

            expect(within(dialog).getByRole("heading", { name: "My Dialog Title" })).toBeInTheDocument();
            expect(within(dialog).getByText("This is my example content.")).toBeInTheDocument();
            expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeInTheDocument();

            await userEvent.click(within(dialog).getByRole("button", { name: "OK" }));

            expect(await resultPromise).toEqual({
                didOkOrSubmit: true,
                model: { result: true },
            });

            expect(dialog).not.toBeInTheDocument();
        });

        it("should open dialog with custom options", async () => {
            class MyDialogContent extends DialogContent {
                public constructor(props: DialogProps) {
                    super(props);
                }
                trySubmit = async () => ({ result: true });
                render = () => <p>This is my example content.</p>;
            }

            const api = new ProxiedModuleApi();

            const resultPromise = api.openDialog<{ result: boolean }, DialogProps, MyDialogContent>(
                {
                    title: "My Custom Dialog Title",
                    actionLabel: "Submit it",
                    cancelLabel: "Cancel it",
                    canSubmit: false,
                },
                (props, ref) => <MyDialogContent ref={ref} {...props} />,
            );

            const dialog = await screen.findByRole("dialog");

            expect(within(dialog).getByRole("heading", { name: "My Custom Dialog Title" })).toBeInTheDocument();
            expect(within(dialog).getByText("This is my example content.")).toBeInTheDocument();
            expect(within(dialog).getByRole("button", { name: "Submit it" })).toBeDisabled();

            await userEvent.click(within(dialog).getByRole("button", { name: "Cancel it" }));

            expect(await resultPromise).toEqual({ didOkOrSubmit: false });

            expect(dialog).not.toBeInTheDocument();
        });

        it("should update the options from the opened dialog", async () => {
            class MyDialogContent extends DialogContent {
                public constructor(props: DialogProps) {
                    super(props);
                }
                trySubmit = async () => ({ result: true });
                render = () => {
                    const onClick = () => {
                        this.props.setOptions({
                            title: "My New Title",
                            actionLabel: "New Action",
                            cancelLabel: "New Cancel",
                        });

                        // check if delta updates work
                        this.props.setOptions({
                            canSubmit: false,
                        });
                    };

                    return (
                        <button type="button" onClick={onClick}>
                            Change the settings!
                        </button>
                    );
                };
            }

            const api = new ProxiedModuleApi();

            const resultPromise = api.openDialog<{ result: boolean }, DialogProps, MyDialogContent>(
                "My Dialog Title",
                (props, ref) => <MyDialogContent ref={ref} {...props} />,
            );

            const dialog = await screen.findByRole("dialog");

            expect(within(dialog).getByRole("heading", { name: "My Dialog Title" })).toBeInTheDocument();
            expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
            expect(within(dialog).getByRole("button", { name: "OK" })).toBeEnabled();

            await userEvent.click(within(dialog).getByRole("button", { name: "Change the settings!" }));

            expect(within(dialog).getByRole("heading", { name: "My New Title" })).toBeInTheDocument();
            expect(within(dialog).getByRole("button", { name: "New Action" })).toBeDisabled();

            await userEvent.click(within(dialog).getByRole("button", { name: "New Cancel" }));

            expect(await resultPromise).toEqual({
                didOkOrSubmit: false,
                model: undefined,
            });

            expect(dialog).not.toBeInTheDocument();
        });

        it("should cancel the dialog from within the dialog", async () => {
            class MyDialogContent extends DialogContent {
                public constructor(props: DialogProps) {
                    super(props);
                }
                trySubmit = async () => ({ result: true });
                render = () => (
                    <button type="button" onClick={this.props.cancel}>
                        No need for action
                    </button>
                );
            }

            const api = new ProxiedModuleApi();

            const resultPromise = api.openDialog<{ result: boolean }, DialogProps, MyDialogContent>(
                "My Dialog Title",
                (props, ref) => <MyDialogContent ref={ref} {...props} />,
            );

            const dialog = await screen.findByRole("dialog");

            await userEvent.click(within(dialog).getByRole("button", { name: "No need for action" }));

            expect(await resultPromise).toEqual({
                didOkOrSubmit: false,
                model: undefined,
            });

            expect(dialog).not.toBeInTheDocument();
        });
    });

    describe("getApps", () => {
        it("should return apps from the widget store", () => {
            const api = new ProxiedModuleApi();
            const app = {} as unknown as IApp;
            const apps: IApp[] = [app];

            jest.spyOn(WidgetStore.instance, "getApps").mockReturnValue(apps);
            expect(api.getApps("!room:example.com")).toEqual(apps);
        });
    });

    describe("getAppAvatarUrl", () => {
        const app = {} as unknown as IApp;
        const avatarUrl = "https://example.com/avatar.png";

        let api: ProxiedModuleApi;
        let client: Mocked<MatrixClient>;

        beforeEach(() => {
            api = new ProxiedModuleApi();
            client = getMockClientWithEventEmitter({ mxcUrlToHttp: jest.fn().mockReturnValue(avatarUrl) });
        });

        it("should return null if the app has no avatar URL", () => {
            expect(api.getAppAvatarUrl(app)).toBeNull();
        });

        it("should return the app avatar URL", () => {
            expect(api.getAppAvatarUrl({ ...app, avatar_url: avatarUrl })).toBe(avatarUrl);
        });

        it("should support optional thumbnail params", () => {
            api.getAppAvatarUrl({ ...app, avatar_url: avatarUrl }, 1, 2, "3");
            // eslint-disable-next-line no-restricted-properties
            expect(client.mxcUrlToHttp).toHaveBeenCalledWith(avatarUrl, 1, 2, "3");
        });
    });

    describe("isAppInContainer", () => {
        const app = {} as unknown as IApp;
        const roomId = "!room:example.com";

        let api: ProxiedModuleApi;
        let client: MatrixClient;

        beforeEach(() => {
            api = new ProxiedModuleApi();
            client = stubClient();

            jest.spyOn(WidgetLayoutStore.instance, "isInContainer");
        });

        it("should return false if there is no room", () => {
            client.getRoom = jest.fn().mockReturnValue(null);

            expect(api.isAppInContainer(app, Container.Top, roomId)).toBe(false);
            expect(WidgetLayoutStore.instance.isInContainer).not.toHaveBeenCalled();
        });

        it("should return false if the app is not in the container", () => {
            jest.spyOn(WidgetLayoutStore.instance, "isInContainer").mockReturnValue(false);
            expect(api.isAppInContainer(app, Container.Top, roomId)).toBe(false);
        });

        it("should return true if the app is in the container", () => {
            jest.spyOn(WidgetLayoutStore.instance, "isInContainer").mockReturnValue(true);
            expect(api.isAppInContainer(app, Container.Top, roomId)).toBe(true);
        });
    });

    describe("moveAppToContainer", () => {
        const app = {} as unknown as IApp;
        const roomId = "!room:example.com";

        let api: ProxiedModuleApi;
        let client: MatrixClient;

        beforeEach(() => {
            api = new ProxiedModuleApi();
            client = stubClient();

            jest.spyOn(WidgetLayoutStore.instance, "moveToContainer");
        });

        it("should not move if there is no room", () => {
            client.getRoom = jest.fn().mockReturnValue(null);
            api.moveAppToContainer(app, Container.Top, roomId);
            expect(WidgetLayoutStore.instance.moveToContainer).not.toHaveBeenCalled();
        });

        it("should move if there is a room", () => {
            const room = mkRoom(client, roomId);
            client.getRoom = jest.fn().mockReturnValue(room);

            api.moveAppToContainer(app, Container.Top, roomId);
            expect(WidgetLayoutStore.instance.moveToContainer).toHaveBeenCalledWith(room, app, Container.Top);
        });
    });
});
