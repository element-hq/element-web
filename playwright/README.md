To update snapshots you will need to run Playwright on a Linux machine.
If you have access to docker then you can use the following:

```shell
docker run \
    --rm \
    --network host \
    -v $(pwd)/../:/work/ \
    -v playwright-ew-node-modules:/work/element-web/node_modules \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v /tmp/:/tmp/ \
    -w /work/matrix-react-sdk \
    -it mcr.microsoft.com/playwright:v1.40.0-jammy \
    sh -c "apt-get update && apt-get -y install docker.io && yarn --cwd ../element-web install && npx playwright test --update-snapshots --reporter line"
```
