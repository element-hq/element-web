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
export type * from "./api/custom-components";
export type * from "./api/legacy-modules";
export type * from "./api/legacy-customisations";
