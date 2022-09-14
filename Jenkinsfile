pipeline {
    agent {
        kubernetes {
          label 'node-build'
          yamlFile 'ci/build-pod.yaml'
        }
    }

    stages {
        stage('Build') {
            steps {
                container('node') {
                    sh 'ci/build.sh'
                }
            }
        }
        stage('Test') {
            steps {
                container('node') {
                    sh 'ci/test.sh'
                }
            }
        }
        stage('Upload to Nexus') {
            steps {
              container('node') {
                  sh 'touch archive.tar.gz'
                  sh 'tar -czf archive.tar.gz --exclude=archive.tar.gz .'
                  archiveArtifacts 'archive.tar.gz'

                  nexusArtifactUploader(
                      nexusVersion: 'nexus3',
                      protocol: 'https',
                      nexusUrl: 'nexus.shire.blue',
                      groupId: 'shire.vendored',
                      version: "${currentBuild.startTimeInMillis}",
                      repository: 'shire-raw',
                      credentialsId: 'nexus-docker-config',
                      artifacts: [
                          [artifactId: 'element-web-vendored',
                           classifier: 'vendor',
                           file: 'archive.tar.gz',
                           type: 'tar']
                      ]
                   )
              }
           }
        }
    }
}
