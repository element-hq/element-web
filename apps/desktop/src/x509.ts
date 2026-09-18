/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import type * as Graphene from "graphene-pk11";
import { X509Certificate } from "node:crypto";
import type Pkcs11 from "pkcs11js";
import { readFile } from "node:fs/promises";
import type {
    CertificateInfo,
    HardwareKey,
    HardwareKeyState,
    UserCertificate,
    X509Failure,
    X509IpcCommand,
    X509IpcErrorCode,
    X509LoginResult,
    X509Result,
} from "shared-types";
import { ipcMain } from "electron";
import { getConfig } from "./config.js";

//#region IPC

/**
 * A top-level reference to `graphene-pk11`. This is only ever defined if `pkcs11js` is installed and was imported successfully.
 */
let graphene: typeof Graphene;

/**
 * A top-level reference to `pkcs11js`. This is only ever defined if `pkcs11js` is installed and was imported successfully.
 */
let pkcs11: typeof Pkcs11;

/**
 * The PKCS#11 module, if it has been loaded successfully. If this is `null`, X.509 support is disabled.
 */
let module: Graphene.Module | null = null;

/**
 * Promise that resolves when the PKCS#11 module has been loaded. Used to avoid multiple concurrent loads.
 */
let moduleLoad: Promise<void> | undefined;

/**
 * Open PKCS#11 sessions, keyed by token serial number.
 */
const sessions: Record<string, { session: Graphene.Session; authenticated: boolean }> = {};

// Top-level IPC handler.
ipcMain.handle("x509", async (_ev, name: X509IpcCommand, ...args: unknown[]): Promise<X509Result<unknown>> => {
    try {
        return await handleIpcX509(name, args);
    } catch (e) {
        // Fall back to a generic error if something goes wrong in a way we didn't expect.
        // This should only ever happen in the case of programming errors in the renderer.
        return fail("UNKNOWN", e instanceof Error ? e.message : String(e));
    }
});

async function handleIpcX509(name: string, args: unknown[]): Promise<X509Result<unknown>> {
    switch (name) {
        case "getUserCertificate":
            return await getUserCertificate();

        case "listHardwareKeys":
            return await ipcListHardwareKeys();

        case "getKeyState":
            return await ipcGetKeyState(args[0] as string);

        case "logIntoKey":
            return await ipcLogIntoKey(args[0] as string, args[1] as string);

        case "signData":
            return await ipcSignData(args[0] as string, args[1] as Uint8Array);

        default:
            return fail("UNKNOWN", `Unknown X.509 IPC command ${name}`);
    }
}

/**
 * IPC call to list available hardware keys.
 */
async function ipcListHardwareKeys(): Promise<X509Result<HardwareKey[]>> {
    let result = await getModuleInstance();
    if (!result.ok) {
        // This is an error variant, so we can just return it directly.
        return result;
    }
    try {
        if (result.data.getSlots(true).length === 0) {
            // PKCS#11 module implementations can cache the hardware key list, so we reload it
            // just in case if no keys are found.
            await reloadModule();
            result = await getModuleInstance();
            if (!result.ok) {
                // This is an error variant, so we can just return it directly.
                return result;
            }
        }
    } catch (e) {
        return failFrom(e);
    }
    try {
        const slots = result.data.getSlots(true);
        const keys: HardwareKey[] = [];
        for (let slot = 0; slot < slots.length; slot++) {
            const {
                label,
                serialNumber,
                manufacturerID,
                model,
                maxPinLen: maxPinLength,
                minPinLen: minPinLength,
            } = slots.items(slot).getToken();
            keys.push({
                label,
                serialNumber,
                manufacturerID,
                model,
                maxPinLength,
                minPinLength,
            });
        }
        return ok(keys);
    } catch (e) {
        return failFrom(e);
    }
}

/**
 * IPC call reporting how far along the signing sequence the given hardware key is.
 */
async function ipcGetKeyState(serialNumber: string): Promise<X509Result<HardwareKeyState>> {
    const result = await getSession(serialNumber);
    if (!result.ok) {
        if (result.error.code === "MODULE_NOT_LOADED") {
            // This is an error variant, so we can just return it directly.
            return result;
        }
        return ok("absent");
    }
    if (result.data.authenticated) {
        return ok("authenticated");
    }
    const keyId = await findSigningKeyId(serialNumber);
    if (!keyId.ok) {
        switch (keyId.error.code) {
            case "CERTIFICATE_NOT_FOUND":
                return keyId;
            case "PRIVATE_KEY_NOT_FOUND":
                return ok("noSigningKey");
            default:
                return ok("absent");
        }
    }
    return ok("open");
}

/**
 * IPC call to log in to the given hardware key, so that `signData` can use its private key.
 */
async function ipcLogIntoKey(serialNumber: string, pin: string): Promise<X509LoginResult> {
    const result = await getSession(serialNumber);
    if (!result.ok) {
        // This is an error variant, so we can just return it directly.
        return result;
    }
    try {
        result.data.session.login(pin);
        result.data.authenticated = true;
        // No data returned, but `undefined` is a little unclear.
        return ok(void null);
    } catch (e) {
        const { error } = failFrom(e);
        const triesRemaining = decodeTriesRemaining(result.data.session.slot.getToken().flags);
        return { ok: false, error: { ...error, triesRemaining } };
    }
}

/**
 * IPC call to sign the given data with the key belonging to our configured certificate.
 * Requires `logIntoKey` to have been called successfuly first.
 */
async function ipcSignData(keySerialNumber: string, data: Uint8Array): Promise<X509Result<Uint8Array>> {
    const sessionResult = await getSession(keySerialNumber);
    if (!sessionResult.ok) {
        return sessionResult;
    }
    if (!sessionResult.data.authenticated) {
        return fail("LOGIN_REQUIRED", "logIntoKey must succeed before signing");
    }
    const signingKeyResult = await findSigningKeyId(keySerialNumber);
    if (!signingKeyResult.ok) {
        return signingKeyResult;
    }

    try {
        const pks = sessionResult.data.session.find({
            class: graphene.ObjectClass.PRIVATE_KEY,
            id: Buffer.from(signingKeyResult.data, "hex"),
        });
        if (pks.length === 0) {
            return fail("PRIVATE_KEY_NOT_FOUND");
        }
        const pk = pks.items(0).toType<Graphene.Key>();

        return ok(
            sessionResult.data.session
                .createSign(
                    {
                        name: "SHA512_RSA_PKCS_PSS",
                        params: new graphene.RsaPssParams(
                            graphene.MechanismEnum.SHA512,
                            graphene.RsaMgf.MGF1_SHA512,
                            64,
                        ),
                    },
                    pk,
                )
                .once(Buffer.from(data)),
        );
    } catch (e) {
        return failFrom(e, keySerialNumber);
    }
}

//#endregion

//#region HSM Managment

/**
 * Loads the PKCS#11 library specified in the X.509 config, or returns a cached instance if this method has
 * previously been called successfully.
 */
async function getModuleInstance(): Promise<X509Result<Graphene.Module>> {
    moduleLoad ??= (async () => {
        const config = getConfig().x509;
        if (!config) {
            return;
        }
        try {
            graphene = await import("graphene-pk11");
            pkcs11 = (await import("pkcs11js")).default;
            // Load and initialise the underlying PKCS#11 native library.
            module = graphene.Module.load(config.library_path, config.library_name);
            module.initialize();
        } catch (e) {
            console.warn(`Failed to load PKCS#11 library ${config.library_path}, X.509 support is disabled:`, e);
        }
    })();
    await moduleLoad;
    return module ? ok(module) : fail("MODULE_NOT_LOADED");
}

/**
 * Finalises the PKCS#11 module and initialises it again, so that later calls to `getModuleInstance`
 * reflect the keys inserted since the module was loaded. The existing module instance and all open
 * sessions are dropped, so any key that was logged in must be logged into again.
 *
 * Some libraries only enumerate readers on initialisation (including Yubikey's libykcs11) and never
 * refresh the list afterwards, forcing us to reload the module to see new keys. Most infuriating!
 *
 */
async function reloadModule(): Promise<void> {
    for (const serialNumber of Object.keys(sessions)) {
        delete sessions[serialNumber];
    }
    try {
        // Inform the underlying library that we're done with it, presumably so it can clean up its own resources.
        module?.finalize();
    } catch (e) {
        console.warn("Failed to finalize the PKCS#11 module before reloading it:", e);
    }
    // Clean up old references to the module in advance of reloading it - if the reload fails, we don't want
    // a stale module reference hanging around.
    module = null;
    moduleLoad = undefined;
    // Prepare a fresh instance in advance of the next call to `getModuleInstance`.
    await getModuleInstance();
}

/**
 * Get the session for the hardware key with the given serial number.
 */
async function getSession(
    serialNumber: string,
): Promise<X509Result<{ session: Graphene.Session; authenticated: boolean }>> {
    const result = await getModuleInstance();
    if (!result.ok) {
        // This is an error variant, so we can just return it directly.
        return result;
    }

    // If we already have a session for this key, return it.
    if (sessions[serialNumber]) {
        return ok(sessions[serialNumber]);
    }

    // Otherwise, let's look for the key and attempt to open a new session.
    try {
        for (const slot of result.data.getSlots(true)) {
            if (slot.getToken().serialNumber == serialNumber) {
                return ok((sessions[serialNumber] = { session: slot.open(), authenticated: false }));
            }
        }
    } catch (e) {
        return failFrom(e);
    }

    return fail("KEY_NOT_FOUND");
}

/**
 * Fetch the RSA public key of the current user's configured certificate.
 */
async function getSigningPublicKey(): Promise<{ modulus: Buffer; publicExponent: Buffer } | null> {
    const result = await readUserCertificate();
    if (!result.ok) {
        return null;
    }
    const jwk = result.data.leaf.publicKey.export({ format: "jwk" }) as { kty?: string; n?: string; e?: string };
    if (jwk.kty !== "RSA" || !jwk.n || !jwk.e) {
        return null;
    }
    return { modulus: Buffer.from(jwk.n, "base64url"), publicExponent: Buffer.from(jwk.e, "base64url") };
}

/**
 * Finds the `CKA_ID` of the private key on this token that belongs to our configured certificate.
 */
async function findSigningKeyId(keySerialNumber: string): Promise<X509Result<string>> {
    const wanted = await getSigningPublicKey();
    if (!wanted) {
        return fail("CERTIFICATE_NOT_FOUND", "No usable RSA certificate is provisioned on disk");
    }
    const result = await getSession(keySerialNumber);
    if (!result.ok) {
        // This is an error variant, so we can just return it directly.
        return result;
    }

    try {
        for (const object of result.data.session.find({ class: graphene.ObjectClass.PUBLIC_KEY })) {
            const { id, modulus, publicExponent } = object.getAttribute({
                id: null,
                modulus: null,
                publicExponent: null,
            });
            if (!id || !modulus || !publicExponent) {
                continue;
            }
            if (modulus.equals(wanted.modulus) && publicExponent.equals(wanted.publicExponent)) {
                return ok(id.toString("hex"));
            }
        }
    } catch (e) {
        return failFrom(e, keySerialNumber);
    }
    return fail("PRIVATE_KEY_NOT_FOUND", "This hardware key holds no key for the configured certificate");
}

/**
 * Decodes the three `CK_TOKEN_INFO` PIN flags into an attempt count.
 *
 * This method assumes the hardware key has the factory-default of a maximum of 3 tries configured.
 * Any other maximum will make this method report incorrect counts :)
 */
export function decodeTriesRemaining(flags: number): number {
    if (flags & CKF_USER_PIN_LOCKED) {
        return 0;
    }
    if (flags & CKF_USER_PIN_FINAL_TRY) {
        return 1;
    }
    if (flags & CKF_USER_PIN_COUNT_LOW) {
        return 2;
    }
    return 3;
}

// CK_TOKEN_INFO PIN flags inlined from `graphene.TokenFlag`
const CKF_USER_PIN_COUNT_LOW = 0x00010000;
const CKF_USER_PIN_FINAL_TRY = 0x00020000;
const CKF_USER_PIN_LOCKED = 0x00040000;

/**
 * Convert a {@link X509Certificate} to a format that can be sent over IPC.
 */
function toCertificateInfo(cert: X509Certificate): CertificateInfo {
    return {
        issuer: cert.issuer,
        serialNumber: cert.serialNumber,
        subject: cert.subject,
        subjectAltName: cert.subjectAltName,
        validFrom: cert.validFromDate,
        validTo: cert.validToDate,
    };
}

/**
 * Read the current user's certificate chain from the configured PEM file. The file is provisioned by the
 * admin, formatted as the leaf followed by its intermediates. This is then passed to the crypto stack verbatim.
 */
async function readUserCertificate(): Promise<X509Result<{ leaf: X509Certificate; chain: string }>> {
    const certificatePath = getConfig().x509?.certificate_path;
    if (!certificatePath) {
        return fail("CERTIFICATE_NOT_FOUND", "No certificate_path is configured");
    }
    let chain: string;
    try {
        chain = await readFile(certificatePath, "utf8");
    } catch (e) {
        return fail(
            "CERTIFICATE_NOT_FOUND",
            `Could not read ${certificatePath}: ${e instanceof Error ? e.message : e}`,
        );
    }
    let leaf: X509Certificate;
    try {
        // Only the first PEM block is parsed, and that must be the leaf.
        leaf = new X509Certificate(chain);
    } catch {
        return fail("CERTIFICATE_NOT_FOUND", `${certificatePath} does not start with a certificate`);
    }
    if (leaf.ca) {
        return fail("CERTIFICATE_NOT_FOUND", `The first certificate in ${certificatePath} is a CA, expected the leaf`);
    }
    return ok({ leaf, chain });
}

/**
 * Read user's own certificate and chain from disk.
 */
export async function getUserCertificate(): Promise<X509Result<UserCertificate>> {
    const result = await readUserCertificate();
    if (!result.ok) {
        // This is an error variant, so we can just return it directly.
        return result;
    }
    return ok({ certificate: toCertificateInfo(result.data.leaf), chain: result.data.chain });
}

// #endregion

//#region Utils

function ok<T>(data: T): X509Result<T> {
    return { ok: true, data };
}

function fail(code: X509IpcErrorCode, message?: string): X509Failure {
    return { ok: false, error: { code, message } };
}

/**
 * Converts a caught exception into a failed result, keeping the `CKR_*` code.
 * @param e - the exception to convert. This is almost always a `Pkcs11Error` from `pkcs11js`, but can be
 *     from `graphene-pk11` if something goes horrifically wrong.
 * @param staleSessionSerial - if given, the cached session for this key is dropped on a PKCS#11 error so the
 *     next call reopens it rather than reusing a handle the token may no longer recognise.
 * @returns
 */
function failFrom(e: unknown, staleSessionSerial?: string): X509Failure {
    if (pkcs11 && e instanceof pkcs11.Pkcs11Error) {
        if (staleSessionSerial) {
            delete sessions[staleSessionSerial];
        }
        return {
            ok: false,
            error: {
                code: "UPSTREAM_PKCS11",
                pkcs11Code: e.code,
                message: e.message,
            },
        };
    }
    return fail("UNKNOWN", e instanceof Error ? e.message : String(e));
}

//#endregion
