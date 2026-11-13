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
    type ArtifactCreated,
    type BeforeBuildContext,
    type BuildResult,
    type CustomWindowsSign,
    log,
} from "electron-builder";
import type { WindowsSignToolManager } from "app-builder-lib";
import { LogMessageByKey } from "app-builder-lib/out/node-module-collector/moduleManager.js";

import pkg from "./package.json" with { type: "json" };
import { createCachedSign, getAuthenticodeSignature } from "./scripts/sign-cache.ts";
import { assertNoHardLinks } from "./scripts/hard-links.ts";
import { pruneSeshatBinaries } from "./scripts/seshat-binaries.ts";
import { writeMacReleasesJson } from "./scripts/mac-releases.ts";
import { assertArtifactsPresent } from "./scripts/artifacts.ts";
import { assertNativeLibraries } from "./scripts/native-libraries.ts";
import { toSquirrelVersion } from "./scripts/squirrel-version.ts";

/**
 * This script has different outputs depending on your os platform.
 *
 * On all platforms:
 *  Fails the build if a target did not produce the files the deploy & test jobs expect.
 *  Skips electron-updater's update metadata, as we update via Squirrel and our own repositories instead.
 *
 * On Windows:
 *  Passes $ED_SIGNTOOL_THUMBPRINT and $ED_SIGNTOOL_SUBJECT_NAME to
 *      build.win.signtoolOptions.signingHashAlgorithms and build.win.signtoolOptions.certificateSubjectName respectively if specified.
 *  Reuses previously signed DLLs, native modules & Squirrel.exe from $ED_SIGN_CACHE_URL if specified,
 *      writing newly signed ones to $ED_SIGN_CACHE_DIR for uploading to the cache.
 *  Converts a Nightly $VERSION into a semver one, as required by Squirrel.Windows.
 *  Makes native modules compiled during the build reproducible, so they can be reused from the sign cache.
 *
 * On macOS:
 *  Writes releases.json & releases-legacy.json for Squirrel.Mac if $ED_BASE_URL, the URL the build will be deployed to,
 *      is specified.
 *
 * On Linux:
 *  Replaces spaces in the product name with dashes as spaces in paths can cause issues
 *  Passes $ED_DEBIAN_CHANGELOG to build.deb.fpm if specified
 *  Checks the native libraries in the packaged app, failing the build on CI and warning otherwise.
 *  Fails the build if the deb or tar.gz contains hard links.
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
    desktopName: string;
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

/**
 * CI passes the macOS signing credentials as empty strings when not signing, but electron-builder treats an empty
 * CSC_LINK as a certificate to import, so treat empty values as unset.
 */
for (const name of ["CSC_LINK", "CSC_KEY_PASSWORD", "APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_TEAM_ID"]) {
    if (process.env[name] === "") delete process.env[name];
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
const config: Omit<Writable<Configuration>, "electronFuses" | "publish"> & {
    // Make all fuses required to ensure they are all explicitly specified
    electronFuses: Required<Configuration["electronFuses"]>;
    publish: null;
} = {
    appId: variant.appId,
    // We don't use electron-updater, so skip its metadata: latest-*.yml, app-update.yml & the deb package-type file.
    // Otherwise electron-builder infers a GitHub publish configuration from the repository in package.json.
    publish: null,
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
    files: [
        "package.json",
        "lib/**",
        // electron-builder strips node-gyp's Make build leftovers from native modules but not MSBuild's on Windows
        "!**/node_modules/*/build/*.{vcxproj,vcxproj.filters}",
        "!**/node_modules/*/build/Release/{obj,*.iobj,*.ipdb,*.exp,*.lib}",
        // pkcs11js is compiled from source on install, its sources are not needed at runtime
        "!**/node_modules/pkcs11js/{src,includes}",
    ],
    extraResources: ["build/icon.*", "webapp.asar"],
    extraMetadata: {
        name: variant.name,
        productName: variant.productName,
        description: variant.description,
        // Read by Electron to set the Wayland app_id / X11 WM_CLASS, so compositors
        // can associate our windows with the desktop file of the same name.
        // https://www.electron.build/linux#window-association-desktopname--syncdesktopname
        desktopName: `${variant.name}.desktop`,
        electron_appId: variant.appId,
        electron_protocol: variant.protocols[0],
    },
    linux: {
        target: ["tar.gz", "deb"],
        category: "Network;InstantMessaging;Chat",
        icon: "icon.png",
        executableName: variant.name, // element-desktop or element-desktop-nightly
        // Name the desktop file after desktopName and set its StartupWMClass to match
        syncDesktopName: true,
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
        // Skip the blockmap used for electron-updater differential updates
        writeUpdateInfo: false,
    },
    win: {
        target: ["squirrel", "msi"],
        signtoolOptions: {
            signingHashAlgorithms: ["sha256"],
        },
        icon: "build/icon.ico",
        signExts: [".msi", ".exe", ".dll", ".node"],
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

        if (os.platform() === "win32") {
            // Make MSVC output reproducible, so that native modules compiled when rebuilding them (e.g. pkcs11js) are
            // byte-identical between builds and can be reused from the sign cache. -Brepro drops timestamps & random
            // PDB GUIDs, -PDBALTPATH stops the checkout path being embedded via the PDB path.
            process.env._CL_ ??= "-Brepro";
            process.env._LINK_ ??= "-Brepro -PDBALTPATH:%_PDB%";
        }

        return true; // Continue build
    },
    afterPack: async (context: AfterPackContext) => {
        await pruneSeshatBinaries(context);
        // Runs after pruning, as the binaries for other architectures would fail the checks
        await assertNativeLibraries(context);
    },
    artifactBuildCompleted: async (event: ArtifactCreated) => {
        await assertNoHardLinks(event);
    },
    afterAllArtifactBuild: async (buildResult: BuildResult): Promise<string[]> => {
        await assertArtifactsPresent(buildResult);
        return writeMacReleasesJson(buildResult, config.extraMetadata.version ?? pkg.version, process.env.ED_BASE_URL);
    },
};

/**
 * Allow specifying the version via env var.
 * If unspecified, it will default to the version in package.json.
 * @param {string} process.env.VERSION
 */
if (process.env.VERSION) {
    config.extraMetadata.version =
        os.platform() === "win32" ? toSquirrelVersion(process.env.VERSION) : process.env.VERSION;
}

if (variant["linux.deb.name"]) {
    config.deb.fpm.push("--name", variant["linux.deb.name"]);
}

const cachedSign = createCachedSign();

/**
 * Signs a file with signtool, unless it already carries a valid signature, e.g. Microsoft's DirectX DLLs bundled
 * with Electron, or a signed copy can be reused from the sign cache, as EV code signing is charged per signature.
 */
async function signUnlessSigned(...[config, packager]: Parameters<CustomWindowsSign>): Promise<void> {
    // Nested signatures are appended to the one we just made, so the file is expected to be signed already
    if (!config.isNest) {
        try {
            if ((await getAuthenticodeSignature(config.path)).status === "Valid") {
                log.info({ file: log.filePath(config.path) }, "skipped signing as file is already signed");
                return;
            }
        } catch (e) {
            log.warn({ file: log.filePath(config.path), error: String(e) }, "failed to check existing signature");
        }
    }

    if (cachedSign) return cachedSign(config, packager);

    const manager = (await packager!.signingManager.value) as WindowsSignToolManager;
    await manager.doSign(config, packager!);
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
    config.win.signtoolOptions!.sign = signUnlessSigned;
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
