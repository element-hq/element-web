/**
 * Packages the storybook-launcher extension into a .vsix file.
 *
 * A .vsix is an OPC (Open Packaging Conventions) zip archive containing:
 *   [Content_Types].xml   – MIME type declarations
 *   extension.vsixmanifest – extension metadata
 *   extension/             – the actual VS Code extension files
 *
 * This script uses only Node built-ins and the `zip` CLI (pre-installed on Debian).
 */

import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const launcherDir = import.meta.dirname;
const buildDir = join(launcherDir, ".build");
const extensionSrc = join(launcherDir, "extension");

const pkg = JSON.parse(readFileSync(join(extensionSrc, "package.json"), "utf8"));
const vsixPath = join(launcherDir, `${pkg.name}-${pkg.version}.vsix`);

// Clean previous build artifacts
if (existsSync(buildDir)) rmSync(buildDir, { recursive: true });
mkdirSync(buildDir, { recursive: true });

// [Content_Types].xml — required by OPC format
writeFileSync(
    join(buildDir, "[Content_Types].xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension=".json" ContentType="application/json"/>
  <Default Extension=".js" ContentType="application/javascript"/>
  <Default Extension=".svg" ContentType="image/svg+xml"/>
  <Default Extension=".vsixmanifest" ContentType="text/xml"/>
</Types>
`,
);

// extension.vsixmanifest — required by VS Code
writeFileSync(
    join(buildDir, "extension.vsixmanifest"),
    `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Language="en-US" Id="storybook-launcher" Version="${pkg.version}" Publisher="element-hq"/>
    <DisplayName>Storybook Launcher</DisplayName>
    <Description xml:space="preserve">Quick access to the Storybook Playground</Description>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
  </Assets>
</PackageManifest>
`,
);

// Copy extension source into build directory
cpSync(extensionSrc, join(buildDir, "extension"), { recursive: true });

// Create the .vsix zip
execSync(`cd "${buildDir}" && zip -r "${vsixPath}" .`, { stdio: "inherit" });

// Clean up
rmSync(buildDir, { recursive: true });

console.log(`Built: ${vsixPath}`);
