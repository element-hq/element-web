import * as os from "node:os";
import * as fs from "node:fs";
import * as path from "node:path";
import { type Configuration as BaseConfiguration, type Protocol } from "electron-builder";

/**
 * This script has different outputs depending on your os platform.
 *
 * On Windows:
 *  Passes $ED_SIGNTOOL_THUMBPRINT and $ED_SIGNTOOL_SUBJECT_NAME to
 *      build.win.signtoolOptions.signingHashAlgorithms and build.win.signtoolOptions.certificateSubjectName respectively if specified.
 *
 * On Linux:
 *  Replaces spaces in the product name with dashes as spaces in paths can cause issues
 *  Removes libsqlcipher0 recommended dependency if env SQLCIPHER_BUNDLED is asserted.
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
        ...JSON.parse(fs.readFileSync(`${process.env.VARIANT_PATH}`, "utf8")),
    };
} else {
    console.warn(`No VARIANT_PATH specified, using default variant configuration '${DEFAULT_VARIANT}':`);
}

for (const key in variant) {
    console.log(`${key}: ${variant[key]}`);
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
    files: [
        "package.json",
        {
            from: ".hak/hakModules",
            to: "node_modules",
        },
        "lib/**",
    ],
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
        recommends: ["libsqlcipher0", "element-io-archive-keyring"],
        fpm: ["--deb-pre-depends", "libc6 (>= 2.31)"],
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
        x64ArchFiles: "**/matrix-seshat/*.node", // hak already runs lipo
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

    if (process.env.SQLCIPHER_BUNDLED) {
        // Remove sqlcipher dependency when using bundled
        config.deb.recommends = config.deb.recommends?.filter((d) => d !== "libsqlcipher0");
    }
}

export default config;
