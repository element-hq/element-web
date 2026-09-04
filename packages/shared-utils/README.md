# @element-hq/element-web-shared-utils

Standalone, utilities shared by Element projects.

The package provides string-based HTML sanitization and URL validation for
untrusted Matrix-compatible formatted content. It is designed to work in
Element Web as well as in external JavaScript and TypeScript packages.

## Usage

```ts
import { isUrlPermitted, sanitizeHtml } from "@element-hq/element-web-shared-utils";

const safeHtml = sanitizeHtml(untrustedHtml);
const canOpen = isUrlPermitted(untrustedUrl);
```

The same API is available from the explicit HTML entry point:

```ts
import { sanitizeHtml } from "@element-hq/element-web-shared-utils/html";
```

The package does not import React, access browser globals, or depend on
Element Web application code.

## Rendering transforms

The default sanitizer applies the shared Element Web rendering and safety
policy, including safe link handling, MXC-only images, and removal of inline
styles. The `transformTags` option is a trusted application extension point:
providing a transform for a tag replaces that tag's shared rendering transform.
Applications should only use this for a deliberately narrower or explicitly
trusted rendering context. Anchor URL validation and the sanitizer's attribute
and URL checks remain active.

## Copyright & License

Copyright (c) 2026 Element Creations Ltd.

This software is licensed under the terms described in the repository license
files.

## Publish a new version

To carry out a release, see the documentation at [`../RELEASING.md`](../RELEASING.md).
