/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export { ModuleLoader, ModuleIncompatibleError } from "./loader";
export type { Api, Module, ModuleFactory } from "./api";
export type { Config, ConfigApi } from "./api/config";
export type { I18nApi, Variables, Translations } from "./api/i18n";
export type * from "./models/event";
export type * from "./models/Room";
export type * from "./api/custom-components";
export type * from "./api/extras";
export type * from "./api/legacy-modules";
export type * from "./api/legacy-customisations";
export type * from "./api/auth";
export type * from "./api/dialog";
export type * from "./api/profile";
export type * from "./api/navigation";
export type * from "./api/builtins";
export type * from "./api/stores";
export type * from "./api/client";
export type * from "./api/widget-lifecycle";
export * from "./api/watchable";
export type * from "./utils";
