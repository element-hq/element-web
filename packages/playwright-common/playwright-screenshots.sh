#!/bin/bash

set -e

# Handle symlinks here as we tend to be executed as an npm binary
SCRIPT_PATH=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT_PATH")

IMAGE_NAME="element-web-playwright-common"

if docker --version | grep -q podman; then docker_is_podman=1; fi

build_image() {
  echo "Building $IMAGE_NAME image in $SCRIPT_DIR"

  # Check the playwright version
  PM=$(cat package.json | jq -r '.packageManager')
  if [[ $PM == "pnpm@"* ]]; then
    PW_VERSION=$(pnpm list @playwright/test --depth=0 --json | jq -r '.[].devDependencies["@playwright/test"].version')
  else
    PW_VERSION=$(yarn list --pattern @playwright/test --depth=0 --json --non-interactive --no-progress | jq -r '.data.trees[].name | split("@") | last')
  fi
  echo "with Playwright version $PW_VERSION"

  # Build image
  docker build -t "$IMAGE_NAME" --build-arg "PLAYWRIGHT_VERSION=$PW_VERSION" "$SCRIPT_DIR"
}

# Find the docker socket on the host
case "$DOCKER_HOST" in
    unix://*)
        docker_sock="${DOCKER_HOST:7}"
        ;;
    "")
        docker_sock="/var/run/docker.sock"
        ;;
    *)
        echo "$0: unsupported DOCKER_HOST setting '${DOCKER_HOST}'" >&2
        exit 1;
        ;;
esac

RUN_ARGS=(
  --rm
  --network host
  # Pass BASE_URL and CI environment variables to the container
  -e BASE_URL
  -e CI
  # Bind mount the working directory into the container
  -v $(pwd):/work/
  # Bind mount the docker socket so we can run docker commands from the container
  -v "${docker_sock}":/var/run/docker.sock
  # Bind mount /tmp so we can store temporary files
  -v /tmp/:/tmp/
  -it
)

DEFAULT_ARGS=(--grep @screenshot)
LINK_MODULES=true

# Some arguments to customise behaviour so the same script / image can be
# re-used for other screenshot generation.
while [[ $# -gt 0 ]]; do
  case "$1" in
    # Mounts a separate node_modules directory from a docker volume in the container.
    # Must be used if executing something that requires native node modules
    # It's a volume rather than a directory because otherwise things tend to start picking up
    # files from it in the native environment and break.
    --with-node-modules)
      mount_param="type=volume,src=ew-docker-node-modules,dst=/work/node_modules"
      # podman doesn't support `volume-nocopy`
      if [ -z "$docker_is_podman" ]; then mount_param+=",volume-nocopy"; fi
      RUN_ARGS+=(--mount "${mount_param}" -e YARN_INSTALL=true)
      shift
      ;;
    # Disables the automatic detection & linking of node_modules which can clash with developer tooling e.g. pnpm-link
    --no-link-modules)
      LINK_MODULES=false
      shift
      ;;
    # Sets a different entrypoint (in which case the default arguments to the script will be ignored)
    --entrypoint)
      shift
      RUN_ARGS+=(--entrypoint "$1")
      DEFAULT_ARGS=()
      shift
      ;;
    *)
      break
      ;;
  esac
done

build_image

if [[ $LINK_MODULES == true ]]; then
  # Ensure we pass all symlinked node_modules to the container
  pushd node_modules > /dev/null
  SYMLINKS=$(find . -maxdepth 2 -type l -not -path "./.bin/*")
  popd > /dev/null
  for LINK in $SYMLINKS; do
    TARGET=$(readlink -f "node_modules/$LINK") || true
    if [ -d "$TARGET" ]; then
       if [ -n "$docker_is_podman" ]; then
          echo -e "\033[31m" >&2
          cat <<'EOF' >&2
WARNING: `node_modules` contains symlinks, and the support for this in
`playwright-screenshots.sh` is broken under podman due to
https://github.com/containers/podman/issues/25947.

If you get errors such as 'Error: crun: creating `<path>`', then retry this
having `yarn unlink`ed the relevant node modules.
EOF
        echo -e "\033[0m" >&2
      fi
      echo "mounting linked package ${LINK:2} in container"
      RUN_ARGS+=( "-v" "$TARGET:/work/node_modules/${LINK:2}" )
    fi
  done
fi

# Our Playwright fixtures use Testcontainers [1], which uses a docker image
# called Ryuk [2], which will clean up any dangling containers/networks/etc
# after a timeout, if the parent process dies unexpectedly.
#
# To do this, Ryuk requires access to the docker socket, so Testcontainers
# starts the Ryuk container with a bind-mount of `/var/run/docker.sock`.
# However, we're going to be running Playwright (and hence Testcontainers)
# itself in a container, but talking to the Docker daemon on the *host*, which
# means that bind mounts will be relative to the *host* filesystem. In short,
# it will try to bind-mount the *host's* `/var/run/docker.sock` rather than
# that from inside the element-web-playwright-common container.
#
# To solve this problem, we start Ryuk ourselves (with the correct docker
# socket) rather than waiting for Testcontainers to do so. Testcontainers will
# find the running Ryuk instance and connect to it rather than start a new one.
#
# [1] https://testcontainers.com/
# [2] https://github.com/testcontainers/moby-ryuk
docker run -d --rm --label org.testcontainers.ryuk=true -v "${docker_sock}":/var/run/docker.sock -p 8080 --name="playwright-ryuk" testcontainers/ryuk:0.14.0

docker run "${RUN_ARGS[@]}" "$IMAGE_NAME" "${DEFAULT_ARGS[@]}" "$@"
