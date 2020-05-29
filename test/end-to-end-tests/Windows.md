# Running the end-to-end tests on Windows

Windows is not the best platform to run the tests on, but if you have to, enable Windows Subsystem for Linux (WSL)
and start following these steps to get going:

1. Navigate to your working directory (`cd /mnt/c/users/travisr/whatever/matrix-react-sdk` for example).
2. Run `sudo apt-get install unzip python3 virtualenv dos2unix`
3. Run `dos2unix ./test/end-to-end-tests/*.sh ./test/end-to-end-tests/synapse/*.sh ./test/end-to-end-tests/riot/*.sh`
4. Install NodeJS for ubuntu: 
   ```bash
   curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
   sudo apt-get update
   sudo apt-get install nodejs
   ```
5. Start Riot on Windows through `yarn start`
6. While that builds... Run:
   ```bash
   sudo apt-get install x11-apps
   wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
   sudo dpkg -i google-chrome-stable_current_amd64.deb
   sudo apt -f install
   ```
7. Run: 
   ```bash
   cd ./test/end-to-end-tests
   ./synapse/install.sh
   ./install.sh
   ./run.sh --riot-url http://localhost:8080 --no-sandbox
   ```

Note that using `yarn test:e2e` probably won't work for you. You might also have to use the config.json from the
`riot/config-template` directory in order to actually succeed at the tests.

Also note that you'll have to use `--no-sandbox` otherwise Chrome will complain that there's no sandbox available. You
could probably fix this with enough effort, or you could run a headless Chrome in the WSL container without a sandbox.


Reference material that isn't fully represented in the steps above (but snippets have been borrowed):
* https://virtualizationreview.com/articles/2017/02/08/graphical-programs-on-windows-subsystem-on-linux.aspx
* https://gist.github.com/drexler/d70ab957f964dbef1153d46bd853c775
