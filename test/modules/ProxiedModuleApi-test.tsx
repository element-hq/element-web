/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
import { TranslationStringsObject } from "@matrix-org/react-sdk-module-api/lib/types/translations";
import { AccountAuthInfo } from "@matrix-org/react-sdk-module-api/lib/types/AccountAuthInfo";
import { DialogContent, DialogProps } from "@matrix-org/react-sdk-module-api/lib/components/DialogContent";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ProxiedModuleApi } from "../../src/modules/ProxiedModuleApi";
import { stubClient } from "../test-utils";
import { setLanguage } from "../../src/languageHandler";
import { ModuleRunner } from "../../src/modules/ModuleRunner";
import { registerMockModule } from "./MockModule";
import defaultDispatcher from "../../src/dispatcher/dispatcher";
import { Action } from "../../src/dispatcher/actions";

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
});
