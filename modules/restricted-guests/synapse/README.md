# Synapse Guest Module

A [pluggable synapse module](https://matrix-org.github.io/synapse/latest/modules/index.html) to restrict the actions of guests.

**Features:**

1. Provides an endpoint that creates temporary users with a same pattern (default: `guest-[randomstring]`).
2. The temporary users have a mandatory displayname suffix (default: ` (Guest)`) that they can't remove from their profile.
3. The temporary users are limited in what they can do (examples: create room, invite users).
4. The temporary users won't be returned by the user directory search results.
5. The temporary users are disabled after an expiration timeout (default: `24 hours`).

## Synapse configuration

This modules requires that the homeserver has the following configuration in their `homeserver.yaml`:

```yaml
# Required so Element is able to show the room preview where the user can login.
allow_guest_access: true
```

## Module installation

Copy the `synapse_guest_module` folder into the python modules path.
This can also be achieved by the [`PYTHONPATH` environment variable](https://docs.python.org/3/using/cmdline.html#envvar-PYTHONPATH).

Add module configuration into `modules` section of `homeserver.yaml`:

```yaml
modules:
  - module: synapse_guest_module.GuestModule
    config: {}
```

## Module configuration

The module provides (optional) configuration options:

- `user_id_prefix` - the prefix of the usernames that are created by this module. Default: `guest-`.
- `display_name_suffix` - the suffix added to the display name of guest users. Default: ` (Guest)`.
- `enable_user_reaper` - if true, the module disables all users that are older than the configured expiration time. Default: `true`.
- `user_expiration_seconds` - the expiration time in seconds when a guest user expires after their creation. Default: `86400` (=24 hours).

Example configuration:

```yaml
modules:
  - module: synapse_guest_module.GuestModule
    config:
      # Use a german suffix
      display_name_suffix: ' (Gast)'
```

## Production installation

The module is not published to a python registry, but we provide a docker container that can be used as an `initContainer` in Kubernetes:

```diff
  apiVersion: apps/v1
  kind: "StatefulSet"
  metadata:
    name: synapse
  spec:
    # ...
    template:
      spec:
+       # The init container copies the module to he `synapse-modules` volume
+       initContainers:
+         - image: ghcr.io/nordeck/synapse-guest-module:<version>
+           name: install-guest-module
+           volumeMounts:
+           - mountPath: /modules
+             name: synapse-modules
        containers:
          - name: "synapse"
            image: "matrixdotorg/synapse:v1.87.0"
+           env:
+             # Tell python to read the modules from the `/modules` directory
+             - name: PYTHONPATH
+               value: /modules
+           volumeMounts:
+             # Mount the `synapse-modules` volume
+             - mountPath: /modules
+               name: synapse-modules
            # ...
+       # Use a local volume to store the module
+       volumes:
+         - emptyDir:
+             medium: Memory
+             sizeLimit: 50Mi
+           name: synapse-modules
          # ...
```
