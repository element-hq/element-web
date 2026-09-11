/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import * as os from "node:os";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import path from "node:path";
import {
    type Configuration as BaseConfiguration,
    type AfterPackContext,
    type BeforeBuildContext,
    Arch,
    log,
} from "electron-builder";
import { LogMessageByKey } from "app-builder-lib/out/node-module-collector/moduleManager.js";

/**
 * This script has different outputs depending on your os platform.
 *
 * On Windows:
 *  Passes $ED_SIGNTOOL_THUMBPRINT and $ED_SIGNTOOL_SUBJECT_NAME to
 *      build.win.signtoolOptions.signingHashAlgorithms and build.win.signtoolOptions.certificateSubjectName respectively if specified.
 *
 * On Linux:
 *  Replaces spaces in the product name with dashes as spaces in paths can cause issues
 *  Passes $ED_DEBIAN_CHANGELOG to build.deb.fpm if specified
 */

/**
 * Interface describing relevant fields of the package.json file.
 */
interface Pkg {
    version: string;
}

/**
 * Base metadata fields, used in both package.json and the variant configuration.
 */
interface Metadata {
    name: string;
    productName: string;
    description: string;
}

/**
 * Extra metadata fields that are injected into the build to pass to the app at runtime.
 */
interface ExtraMetadata extends Metadata {
    electron_appId: string;
    electron_protocol: string;
    electron_windows_cert_sn?: string;
}

/**
 * Interface describing the variant configuration format.
 */
interface Variant extends Metadata {
    "appId": string;
    "linux.executableName"?: string;
    "linux.deb.name"?: string;
    "protocols": string[];
}

type Writable<T> = NonNullable<
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    T extends Function ? T : T extends object ? { -readonly [K in keyof T]: Writable<T[K]> } : T
>;

// Load the default variant as a base configuration
const DEFAULT_VARIANT = path.join("element.io", "release", "build.json");
let variant: Variant = JSON.parse(fs.readFileSync(DEFAULT_VARIANT, "utf8"));

/**
 * If a variant is specified, we will use it to override the build-specific values.
 * This allows us to have different builds for different purposes (e.g. stable, nightly).
 */
if (process.env.VARIANT_PATH) {
    console.log(`Using variant configuration from '${process.env.VARIANT_PATH}':`);
    variant = {
        ...variant,
        ...JSON.parse(fs.readFileSync(process.env.VARIANT_PATH, "utf8")),
    };
} else {
    console.warn(`No VARIANT_PATH specified, using default variant configuration '${DEFAULT_VARIANT}':`);
}

for (const key in variant) {
    console.log(`${key}: ${variant[key as keyof Variant]}`);
}

interface Configuration extends BaseConfiguration {
    extraMetadata: Partial<Pick<Pkg, "version">> & ExtraMetadata;
    linux: BaseConfiguration["linux"];
    win: BaseConfiguration["win"];
    mac: BaseConfiguration["mac"];
    deb: {
        fpm: string[];
    } & BaseConfiguration["deb"];
}

/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
const config: Omit<Writable<Configuration>, "electronFuses"> & {
    // Make all fuses required to ensure they are all explicitly specified
    electronFuses: Required<Configuration["electronFuses"]>;
} = {
    appId: variant.appId,
    asarUnpack: "**/*.node",
    electronFuses: {
        enableCookieEncryption: true,
        onlyLoadAppFromAsar: true,
        grantFileProtocolExtraPrivileges: false,

        runAsNode: false,
        enableNodeOptionsEnvironmentVariable: false,
        enableNodeCliInspectArguments: false,
        // We need to reset the signature if we are not signing on darwin otherwise it won't launch
        resetAdHocDarwinSignature: !process.env.APPLE_TEAM_ID,

        loadBrowserProcessSpecificV8Snapshot: false,
        enableEmbeddedAsarIntegrityValidation: true,
    },
    files: ["package.json", "lib/**"],
    extraResources: ["build/icon.*", "webapp.asar"],
    extraMetadata: {
        name: variant.name,
        productName: variant.productName,
        description: variant.description,
        electron_appId: variant.appId,
        electron_protocol: variant.protocols[0],
    },
    linux: {
        target: ["tar.gz", "deb"],
        category: "Network;InstantMessaging;Chat",
        icon: "icon.png",
        executableName: variant.name, // element-desktop or element-desktop-nightly
    },
    deb: {
        packageCategory: "net",
        depends: [
            "libgtk-3-0",
            "libnotify4",
            "libnss3",
            "libxss1",
            "libxtst6",
            "xdg-utils",
            "libatspi2.0-0",
            "libuuid1",
            "libsecret-1-0",
            "libasound2",
            "libgbm1",
        ],
        recommends: ["element-io-archive-keyring"],
        fpm: ["--deb-pre-depends", "libc6 (>= 2.35)"],
    },
    mac: {
        target: ["dmg", "zip"],
        category: "public.app-category.social-networking",
        darkModeSupport: true,
        hardenedRuntime: true,
        gatekeeperAssess: true,
        strictVerify: true,
        entitlements: "./build/entitlements.mac.plist",
        icon: "build/icon.icon",
        mergeASARs: true,
        // The prebuilt seshat binaries are single-arch and present in both halves of the universal build,
        // the loader picks the right one at runtime so they must not be lipo'd together.
        x64ArchFiles: "**/@matrix-org/seshat-darwin-*/*.node",
    },
    dmg: {
        badgeIcon: "build/icon.icon",
    },
    win: {
        target: ["squirrel", "msi"],
        signtoolOptions: {
            signingHashAlgorithms: ["sha256"],
        },
        icon: "build/icon.ico",
    },
    msi: {
        perMachine: true,
    },
    directories: {
        output: "dist",
    },
    protocols: {
        name: variant.productName,
        schemes: variant.protocols,
    },
    nativeRebuilder: "sequential",
    nodeGypRebuild: false,
    npmRebuild: true,
    beforeBuild: async (context: BeforeBuildContext) => {
        // Assert that the webapp.asar file exists
        try {
            await fsp.access(path.join(context.appDir, "webapp.asar"), fs.constants.F_OK);
        } catch (err) {
            console.error("The webapp.asar archive is missing. Building without a webapp is fruitless.");
            console.log(
                "RTFM https://github.com/element-hq/element-web/blob/develop/apps/desktop/README.md#fetching-element.",
            );
            throw err;
        }
        return true; // Continue build
    },
    afterPack: async (context: AfterPackContext) => {
        // @matrix-org/seshat pulls in a prebuilt binary package per platform+arch as optional dependencies.
        // CI installs more than one of them so that cross-arch builds work, so prune the ones we don't need
        // from the packaged app. We always keep both darwin architectures as electron-builder packs each half
        // of a universal build separately, and @electron/universal requires them to contain the same files.
        const platform = context.electronPlatformName;
        const arch = Arch[context.arch];
        const keep = platform === "darwin" ? /^seshat-darwin-/ : new RegExp(`^seshat-${platform}-${arch}$`);

        const modulesDir = path.join(
            context.packager.getResourcesDir(context.appOutDir),
            "app.asar.unpacked",
            "node_modules",
            "@matrix-org",
        );
        let entries: string[];
        try {
            entries = await fsp.readdir(modulesDir);
        } catch {
            return; // No unpacked seshat binaries in this build
        }
        for (const entry of entries) {
            if (entry.startsWith("seshat-") && !keep.test(entry)) {
                console.log(`Pruning ${entry} from ${platform}-${arch} build`);
                await fsp.rm(path.join(modulesDir, entry), { recursive: true, force: true });
            }
        }
    },
};

/**
 * Allow specifying the version via env var.
 * If unspecified, it will default to the version in package.json.
 * @param {string} process.env.VERSION
 */
if (process.env.VERSION) {
    config.extraMetadata.version = process.env.VERSION;
}

if (variant["linux.deb.name"]) {
    config.deb.fpm.push("--name", variant["linux.deb.name"]);
}

/**
 * Allow specifying windows signing cert via env vars
 * @param {string} process.env.ED_SIGNTOOL_SUBJECT_NAME
 * @param {string} process.env.ED_SIGNTOOL_THUMBPRINT
 */
if (process.env.ED_SIGNTOOL_SUBJECT_NAME && process.env.ED_SIGNTOOL_THUMBPRINT) {
    config.win.signtoolOptions!.certificateSubjectName = process.env.ED_SIGNTOOL_SUBJECT_NAME;
    config.win.signtoolOptions!.certificateSha1 = process.env.ED_SIGNTOOL_THUMBPRINT;
    config.extraMetadata.electron_windows_cert_sn = config.win.signtoolOptions!.certificateSubjectName;
}

if (os.platform() === "linux") {
    // Electron crashes on debian if there's a space in the path.
    // https://github.com/vector-im/element-web/issues/13171
    config.extraMetadata.productName = config.extraMetadata.productName.replace(/ /g, "-");

    /**
     * Allow specifying deb changelog via env var
     * @param {string} process.env.ED_DEB_CHANGELOG
     */
    if (process.env.ED_DEBIAN_CHANGELOG) {
        config.deb.fpm.push(`--deb-changelog=${process.env.ED_DEBIAN_CHANGELOG}`);
    }
}

// Treat certain warnings as a fatal error
const FATAL_WARNINGS = [LogMessageByKey.PKG_NOT_ON_DISK, LogMessageByKey.PKG_NOT_FOUND];
// Otherwise we just burn time running the tests for no reason.
if (typeof log !== "undefined") {
    const prevTransform = log.messageTransformer;
    log.messageTransformer = (message, level) => {
        if (level === "warn" && FATAL_WARNINGS.some((w) => message.startsWith(w))) {
            throw new Error(`electron-builder: ${message}`);
        }
        return prevTransform?.(message, level) ?? message;
    };
}

export default config;
